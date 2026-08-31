"""
generate_indian_ais_data.py
────────────────────────────
Generates high-resolution AIS mock trajectory data for vessels navigating
major shipping lanes around the Indian Coastline, Arabian Sea, Bay of Bengal,
Mumbai High offshore zone, and the Indian Exclusive Economic Zone (EEZ).

Columns follow standard NOAA / USCG AIS CSV format:
  MMSI,BaseDateTime,LAT,LON,SOG,COG,Heading,VesselName,IMO,CallSign,VesselType,Status,Length,Width,Draft,Cargo,TransceiverClass
"""

import math
import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pathlib import Path

# Indian coastal waypoints and shipping corridor definitions
VESSEL_CORRIDORS = [
    {
        "mmsi": 419000123,
        "name": "MT DESH SHANTI",
        "type": 80,  # Tanker
        "type_str": "VLCC Crude Tanker",
        "length": 333, "width": 60, "draft": 21.5, "cargo": 80,
        "base_speed": 13.8,  # knots
        # Gulf of Kutch -> Mumbai High -> JNPT / Mumbai Port
        "waypoints": [
            (22.45, 68.90),  # Gulf of Kutch entrance
            (21.20, 69.80),  # Saurashtra coast
            (19.80, 71.30),  # Approaching Mumbai High
            (19.10, 72.10),  # Mumbai High West
            (18.90, 72.75),  # Mumbai Anchorage Outer
            (18.95, 72.88),  # JNPT / Jawahar Dweep Crude Berth
        ],
        "start_time": "2026-03-01T04:00:00Z",
        "total_pings": 120,
    },
    {
        "mmsi": 419000456,
        "name": "MV KAVERI PRIDE",
        "type": 70,  # Cargo
        "type_str": "Ultra Large Container Vessel",
        "length": 366, "width": 48, "draft": 14.2, "cargo": 71,
        "base_speed": 18.5,
        # Mundra -> Mumbai -> Goa -> Kochi
        "waypoints": [
            (22.65, 69.60),  # Mundra Port
            (20.50, 71.00),  # Gujarat Offshore
            (18.95, 72.70),  # Mumbai Outer
            (16.50, 73.10),  # Ratnagiri Offshore
            (15.40, 73.60),  # Mormugao Offshore
            (12.80, 74.60),  # Mangalore Offshore
            (9.96, 76.22),   # Kochi Container Terminal (Vallarpadam)
        ],
        "start_time": "2026-03-01T01:30:00Z",
        "total_pings": 140,
    },
    {
        "mmsi": 419000789,
        "name": "MT SAMUDRANIDHI",
        "type": 80,  # Tanker
        "type_str": "Chemical / Product Tanker",
        "length": 183, "width": 32, "draft": 11.8, "cargo": 82,
        "base_speed": 12.5,
        # Kochi -> Cape Comorin -> Tuticorin -> Chennai
        "waypoints": [
            (9.90, 76.15),   # Kochi Refinery Outer
            (8.50, 76.80),   # Vizhinjam Offshore
            (7.90, 77.55),   # Kanyakumari South Tip
            (8.75, 78.20),   # Tuticorin Port
            (10.50, 79.95),  # Nagapattinam Offshore
            (12.00, 80.20),  # Puducherry Offshore
            (13.10, 80.35),  # Chennai Port (Bharathi Dock)
        ],
        "start_time": "2026-03-01T06:00:00Z",
        "total_pings": 130,
    },
    {
        "mmsi": 419000234,
        "name": "MV CHOLA TRADER",
        "type": 70,  # Cargo
        "type_str": "Capesize Bulk Carrier",
        "length": 292, "width": 45, "draft": 17.5, "cargo": 70,
        "base_speed": 11.2,
        # Paradip -> Visakhapatnam -> Kakinada -> Krishnapatnam
        "waypoints": [
            (20.25, 86.68),  # Paradip Port
            (19.00, 85.10),  # Gopalpur Offshore
            (17.65, 83.32),  # Visakhapatnam Port
            (16.90, 82.35),  # Kakinada Deepwater Port
            (15.50, 80.50),  # Machilipatnam Offshore
            (14.25, 80.12),  # Krishnapatnam Port
        ],
        "start_time": "2026-03-01T03:00:00Z",
        "total_pings": 110,
    },
    {
        "mmsi": 419000567,
        "name": "MT RATNA SAGAR",
        "type": 80,  # Tanker
        "type_str": "Crude Shuttle Tanker",
        "length": 245, "width": 42, "draft": 14.0, "cargo": 80,
        "base_speed": 13.0,
        # Mumbai High Oil Field Platform -> Trombay BPCL Jetty
        "waypoints": [
            (19.45, 71.35),  # Mumbai High North Platform
            (19.20, 71.60),  # Mumbai High South
            (19.00, 72.10),  # Traffic Separation Scheme
            (18.92, 72.65),  # Prongs Reef Outer
            (18.96, 72.85),  # Mumbai Inner Harbour / BPCL
        ],
        "start_time": "2026-03-01T08:00:00Z",
        "total_pings": 100,
    },
    {
        "mmsi": 419000890,
        "name": "MV GANGA PIONEER",
        "type": 70,  # Cargo
        "type_str": "Coastal Feeder Container",
        "length": 150, "width": 24, "draft": 8.5, "cargo": 71,
        "base_speed": 14.5,
        # Kolkata / Haldia -> Dhamra -> Paradip -> Chittagong Sea Lane
        "waypoints": [
            (22.02, 88.08),  # Haldia Dock Complex (Hooghly River)
            (21.40, 88.10),  # Sagar Island Roads
            (20.80, 87.10),  # Dhamra Port
            (20.25, 86.75),  # Paradip Roads
            (19.80, 88.50),  # North Bay of Bengal Eastbound
        ],
        "start_time": "2026-03-01T05:30:00Z",
        "total_pings": 95,
    },
    {
        "mmsi": 419000345,
        "name": "ICGS VIKRAM",
        "type": 50,  # Special craft / Patrol
        "type_str": "Offshore Patrol Vessel (Coast Guard)",
        "length": 105, "width": 13.6, "draft": 3.8, "cargo": 50,
        "base_speed": 21.5,
        # Indian Coast Guard EEZ Sector 4 Patrol Grid
        "waypoints": [
            (18.90, 72.70),  # Mumbai Base
            (18.50, 71.50),  # EEZ Grid Alpha
            (17.80, 71.20),  # EEZ Grid Bravo
            (18.20, 70.80),  # Western EEZ Boundary
            (19.00, 71.10),  # Sector 4 Intercept Track
            (19.25, 72.30),  # Mumbai North Approach
        ],
        "start_time": "2026-03-01T02:00:00Z",
        "total_pings": 150,
    },
    {
        "mmsi": 419000678,
        "name": "MT ARABIAN PEARL",
        "type": 80,  # Tanker
        "type_str": "Ultra Large Crude Carrier (ULCC)",
        "length": 380, "width": 68, "draft": 24.0, "cargo": 80,
        "base_speed": 14.0,
        # 8-Degree Channel (Major Global Tanker Highway across South India)
        "waypoints": [
            (7.90, 71.00),  # West of Lakshadweep (Minicoy)
            (8.00, 73.50),  # Minicoy Island Channel
            (7.95, 75.80),  # 8-Degree Channel Axis
            (7.85, 77.90),  # South of Sri Lanka Approach
            (7.70, 80.50),  # Eastbound to Malacca Strait
        ],
        "start_time": "2026-03-01T00:00:00Z",
        "total_pings": 120,
    },
    {
        "mmsi": 419000912,
        "name": "RV SAMUDRA RATNAKARA",
        "type": 50,  # Research
        "type_str": "Oceanographic Survey Vessel",
        "length": 104, "width": 18, "draft": 6.2, "cargo": 51,
        "base_speed": 8.0,
        # Krishna-Godavari Basin Deepwater Survey Track
        "waypoints": [
            (16.50, 82.20),  # Kakinada Survey Port
            (16.20, 82.60),  # KG Basin Deep Block A
            (15.90, 82.40),  # KG Basin Survey Line 1
            (15.70, 82.90),  # KG Basin Survey Line 2
            (16.10, 83.30),  # Deep Offshore Transect
        ],
        "start_time": "2026-03-01T07:15:00Z",
        "total_pings": 105,
    },
    {
        "mmsi": 419000198,
        "name": "MV COROMANDEL STAR",
        "type": 70,  # Cargo
        "type_str": "Geared Bulk Carrier",
        "length": 190, "width": 32, "draft": 12.5, "cargo": 70,
        "base_speed": 12.8,
        # Visakhapatnam -> Gangavaram -> Kakinada -> Chennai
        "waypoints": [
            (17.68, 83.30),  # Visakhapatnam Port
            (17.60, 83.22),  # Gangavaram Port
            (16.80, 82.40),  # Godavari Estuary
            (14.50, 80.30),  # Penna River Mouth Offshore
            (13.15, 80.32),  # Chennai Port Container Terminal
        ],
        "start_time": "2026-03-01T04:45:00Z",
        "total_pings": 115,
    },
]


def calculate_bearing(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    y = math.sin(dlam) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    return bearing


def generate_interpolated_track(waypoints, total_pings, base_speed, start_time_str):
    start_dt = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
    
    # Calculate segment lengths
    segments = []
    total_dist = 0.0
    for i in range(len(waypoints) - 1):
        lat1, lon1 = waypoints[i]
        lat2, lon2 = waypoints[i+1]
        dist = math.hypot(lat2 - lat1, lon2 - lon1)
        segments.append((lat1, lon1, lat2, lon2, dist))
        total_dist += dist

    rows = []
    current_time = start_dt
    
    for ping_idx in range(total_pings):
        progress = ping_idx / max(1, total_pings - 1)
        target_dist = progress * total_dist
        
        accum_dist = 0.0
        curr_lat, curr_lon = waypoints[0]
        curr_cog = 0.0
        
        for lat1, lon1, lat2, lon2, s_dist in segments:
            if accum_dist + s_dist >= target_dist or s_dist == 0:
                seg_prog = (target_dist - accum_dist) / max(1e-6, s_dist)
                curr_lat = lat1 + (lat2 - lat1) * seg_prog
                curr_lon = lon1 + (lon2 - lon1) * seg_prog
                curr_cog = calculate_bearing(lat1, lon1, lat2, lon2)
                break
            accum_dist += s_dist
            
        # Add realistic micro-kinematic ocean drift noise
        lat_noise = random.gauss(0, 0.0008)
        lon_noise = random.gauss(0, 0.0008)
        speed_noise = random.gauss(0, 0.3)
        cog_noise = random.gauss(0, 1.5)
        
        lat = round(curr_lat + lat_noise, 5)
        lon = round(curr_lon + lon_noise, 5)
        sog = round(max(0.5, min(28.0, base_speed + speed_noise)), 1)
        cog = round((curr_cog + cog_noise + 360) % 360, 1)
        heading = int(cog)
        
        # Time step between pings: ~12 to 15 minutes realistic AIS broadcast window for simulation
        time_step_sec = random.randint(700, 950)
        current_time += timedelta(seconds=time_step_sec)
        
        rows.append({
            "BaseDateTime": current_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "LAT": lat,
            "LON": lon,
            "SOG": sog,
            "COG": cog,
            "Heading": heading,
        })
        
    return rows


def generate_indian_ais_dataset():
    all_rows = []
    print(f"Generating realistic Indian Ocean & Arabian Sea AIS paths for {len(VESSEL_CORRIDORS)} vessels...")
    
    for v in VESSEL_CORRIDORS:
        pings = generate_interpolated_track(
            v["waypoints"],
            v["total_pings"],
            v["base_speed"],
            v["start_time"]
        )
        
        for p in pings:
            all_rows.append({
                "MMSI": v["mmsi"],
                "BaseDateTime": p["BaseDateTime"],
                "LAT": p["LAT"],
                "LON": p["LON"],
                "SOG": p["SOG"],
                "COG": p["COG"],
                "Heading": p["Heading"],
                "VesselName": v["name"],
                "IMO": f"IMO{random.randint(9000000, 9999999)}",
                "CallSign": f"VT{random.randint(1000, 9999)}",
                "VesselType": v["type"],
                "Status": 0,  # Under way using engine
                "Length": v["length"],
                "Width": v["width"],
                "Draft": v["draft"],
                "Cargo": v["cargo"],
                "TransceiverClass": "A"
            })
            
    df = pd.DataFrame(all_rows)
    out_csv = Path("data/AIS_INDIAN_OCEAN_MOCK.csv")
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False)
    print(f"✅ Generated {len(df):,} AIS pings saved to: {out_csv}")
    print(f"   Vessels: {df['MMSI'].nunique()} vessels across Indian Coastline")
    return out_csv


if __name__ == "__main__":
    generate_indian_ais_dataset()
