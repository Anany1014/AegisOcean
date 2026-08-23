"""
characterise.py
───────────────
Slick characterisation engine — standalone ML utility.

Given a detected oil slick polygon (GeoJSON) and optional SAR backscatter
statistics, computes geometric and physical properties:

  Geometric:
    - Area (km²) via Haversine polygon formula
    - Perimeter (km) via Haversine segment sum
    - Perimeter-to-Area ratio (PAR) — oil slicks have low PAR (~0.2–0.5)
                                     look-alikes have high PAR (>0.7)
    - Centroid (lon, lat)
    - Elongation (major/minor axis ratio via bounding ellipse fit)

  Physical:
    - Estimated age (hours) from area + wind speed (Fingas & Brown, 2018)
    - Thickness estimate (mm) → Bonn Agreement colour code
    - Look-alike confidence score [0, 1] (higher = more likely wind/biogenic)

Usage:
    from ml.characterise import characterise_slick

    result = characterise_slick(
        polygon_coords=[[72.50, 18.80], [72.52, 18.82], ...],
        wind_speed_ms=5.0,             # optional, from ERA5/forecast
        backscatter_mean=None,         # optional, from SAR product
    )
    # result is a dict matching the incident JSON schema
"""

from __future__ import annotations

import math
from typing import Optional


# ── Haversine utilities ───────────────────────────────────────────────────────

EARTH_RADIUS_KM = 6371.0


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in km between two (lon, lat) points in degrees."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def polygon_area_km2(coords: list[list[float]]) -> float:
    """
    Compute polygon area in km² using the spherical excess formula.
    Coords are [[lon, lat], ...] in degrees (GeoJSON order), ring closed or open.
    """
    # Close ring if open
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]

    # Convert to radians
    lons = [math.radians(c[0]) for c in coords]
    lats = [math.radians(c[1]) for c in coords]

    n = len(coords) - 1
    area = 0.0
    for i in range(n):
        area += (lons[i + 1] - lons[i]) * (2 + math.sin(lats[i]) + math.sin(lats[i + 1]))

    area = abs(area) * EARTH_RADIUS_KM ** 2 / 2.0
    return area


def polygon_perimeter_km(coords: list[list[float]]) -> float:
    """Sum of Haversine segment lengths around the polygon ring."""
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine_km(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1])
    return total


def polygon_centroid(coords: list[list[float]]) -> tuple[float, float]:
    """Simple arithmetic centroid of polygon vertices (lon, lat)."""
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return sum(lons) / len(lons), sum(lats) / len(lats)


def polygon_elongation(coords: list[list[float]]) -> float:
    """
    Elongation = bounding box aspect ratio (max_dim / min_dim).
    Proxy for oil slick shape — highly elongated slicks follow current/wind direction.
    """
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    lon_span = haversine_km(min(lons), 0.0, max(lons), 0.0)
    lat_span = haversine_km(0.0, min(lats), 0.0, max(lats))
    if min(lon_span, lat_span) < 1e-6:
        return 1.0
    return max(lon_span, lat_span) / min(lon_span, lat_span)


# ── Physical properties ───────────────────────────────────────────────────────

def estimate_age_hours(
    area_km2: float,
    wind_speed_ms: float = 5.0,
    spread_rate_base: float = 0.8,
) -> tuple[float, float]:
    """
    Estimate oil slick age using empirical spreading model (Fingas & Brown, 2018).

    Model: area grows at ~ spread_rate_base × wind_speed_ms  km²/hr
    Returns (estimated_age_h, uncertainty_h) — uncertainty ≈ ±30% from wind variance.

    Args:
        area_km2:        Observed slick area.
        wind_speed_ms:   Current wind speed in m/s (default 5 m/s if unknown).
        spread_rate_base: km²/hr per m/s wind (empirical, ~0.8 for fresh crude).
    """
    if wind_speed_ms <= 0:
        wind_speed_ms = 5.0
    spread_rate = spread_rate_base * wind_speed_ms   # km²/hr
    age = area_km2 / spread_rate
    uncertainty = age * 0.30                          # ±30% empirical uncertainty
    return round(age, 2), round(uncertainty, 2)


def estimate_thickness_mm(backscatter_mean: Optional[float]) -> Optional[float]:
    """
    Rough thickness estimate from mean SAR backscatter (dB).
    Based on Bonn Agreement lookup — lower backscatter → thicker film.

    Returns None if backscatter not available.
    This is an approximation; proper inversion needs full SAR product data.
    """
    if backscatter_mean is None:
        return None
    # Empirical linear mapping (−20 dB → ~0.1 mm, −8 dB → ~0.01 mm)
    # Clamped to physically plausible range
    thickness = max(0.001, min(0.5, -0.02 * backscatter_mean - 0.06))
    return round(thickness, 4)


def bonn_agreement_code(thickness_mm: Optional[float]) -> Optional[str]:
    """
    Map thickness (mm) to Bonn Agreement oil appearance code.
    https://www.bonnagreement.org/site/assets/files/1081/pg-09-rr.pdf
    """
    if thickness_mm is None:
        return None
    if thickness_mm < 0.04:
        return "BA-1 (Sheen — silvery/grey)"
    elif thickness_mm < 0.30:
        return "BA-2 (Rainbow)"
    elif thickness_mm < 1.00:
        return "BA-3 (Metallic)"
    elif thickness_mm < 5.00:
        return "BA-4 (Dark — discontinuous)"
    else:
        return "BA-5 (Dark — continuous)"


# ── Look-alike confidence ──────────────────────────────────────────────────────

def look_alike_confidence(
    perimeter_to_area: float,
    elongation: float,
    wind_speed_ms: float = 5.0,
) -> float:
    """
    Heuristic look-alike confidence score [0, 1].
    Higher score = more likely wind streak or biogenic film, NOT oil.

    Rules derived from Brekke & Solberg (2005) SAR look-alike taxonomy:
      - High PAR (>0.7) → wind streaks tend to have high perimeter/area ratio
      - High elongation (>5) → linear wind features
      - High wind speed (>8 m/s) → wind mixing suppresses genuine slicks
    """
    score = 0.0

    # PAR contribution (max 0.4)
    score += min(0.4, (perimeter_to_area / 1.5) * 0.4)

    # Elongation contribution (max 0.3)
    score += min(0.3, ((elongation - 1.0) / 9.0) * 0.3)

    # Wind speed contribution (max 0.3) — high wind suppresses real slicks
    score += min(0.3, (wind_speed_ms / 15.0) * 0.3)

    return round(min(score, 1.0), 3)


# ── Main entry point ──────────────────────────────────────────────────────────

def characterise_slick(
    polygon_coords: list[list[float]],
    wind_speed_ms: float = 5.0,
    backscatter_mean: Optional[float] = None,
) -> dict:
    """
    Full slick characterisation from a GeoJSON polygon ring.

    Args:
        polygon_coords:  List of [lon, lat] pairs (GeoJSON coordinate ring).
        wind_speed_ms:   Surface wind speed in m/s (from ERA5 or forecast).
        backscatter_mean: Mean SAR backscatter in dB (optional, for thickness).

    Returns:
        Dictionary with all geometric and physical properties, matching the
        incident JSON schema consumed by the frontend / backend API.
    """
    area_km2     = polygon_area_km2(polygon_coords)
    perimeter_km = polygon_perimeter_km(polygon_coords)
    par          = perimeter_km / area_km2 if area_km2 > 0 else 0.0
    centroid     = polygon_centroid(polygon_coords)
    elongation   = polygon_elongation(polygon_coords)

    age_h, age_uncertainty_h = estimate_age_hours(area_km2, wind_speed_ms)
    thickness_mm = estimate_thickness_mm(backscatter_mean)
    bonn_code    = bonn_agreement_code(thickness_mm)
    look_alike   = look_alike_confidence(par, elongation, wind_speed_ms)

    return {
        # Geometry
        "areaKm2":               round(area_km2, 4),
        "perimeterKm":           round(perimeter_km, 4),
        "perimeterToAreaRatio":  round(par, 4),
        "centroid":              {"lon": round(centroid[0], 6), "lat": round(centroid[1], 6)},
        "elongation":            round(elongation, 3),
        # Physical
        "estimatedAgeHours":     age_h,
        "ageUncertaintyHours":   age_uncertainty_h,
        "windSpeedMs":           wind_speed_ms,
        "thicknessMm":           thickness_mm,
        "bonnAgreementCode":     bonn_code,
        # Classification hint
        "windArtifactConfidence": look_alike,
    }


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Example: incident inc-2026-003 from mock data
    polygon = [
        [72.82, 19.10], [72.85, 19.13], [72.88, 19.11],
        [72.86, 19.08], [72.83, 19.07], [72.82, 19.10],
    ]

    result = characterise_slick(
        polygon_coords=polygon,
        wind_speed_ms=4.5,
        backscatter_mean=-14.2,
    )

    print("Slick Characterisation Result:")
    print("─" * 40)
    for k, v in result.items():
        print(f"  {k:30s}: {v}")
