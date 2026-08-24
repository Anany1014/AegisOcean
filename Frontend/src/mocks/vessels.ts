export interface VesselDetection {
    id: string;
    shipName: string;
    mmsi: string;
    vesselType: string;
    coordinates: [number, number]; // [lng, lat]
    speedKnots: number;
    headingDeg: number;
    incidentId: string;
    spillAreaKm2: number;
    totalFineUSD: number;
    suspectScore: number;
    status: 'high_risk' | 'monitored' | 'cleared';
    detectedAt: string;
}

export const VESSEL_DETECTIONS: VesselDetection[] = [
    {
        id: 'vessel-244770842',
        shipName: 'MT Pacific Star',
        mmsi: '244770842',
        vesselType: 'Crude Oil Tanker',
        coordinates: [72.48, 18.82],
        speedKnots: 1.2,
        headingDeg: 42,
        incidentId: 'inc-2026-001',
        spillAreaKm2: 14.8,
        totalFineUSD: 198000,
        suspectScore: 0.94,
        status: 'high_risk',
        detectedAt: '2026-08-22T08:15:00Z',
    },
    {
        id: 'vessel-412987654',
        shipName: 'MV Ocean Chemist',
        mmsi: '412987654',
        vesselType: 'Chemical Carrier',
        coordinates: [72.68, 18.65],
        speedKnots: 11.5,
        headingDeg: 135,
        incidentId: 'inc-2026-003',
        spillAreaKm2: 22.5,
        totalFineUSD: 275000,
        suspectScore: 0.82,
        status: 'high_risk',
        detectedAt: '2026-08-22T02:30:00Z',
    },
    {
        id: 'vessel-352002459',
        shipName: 'NEW FRONTIER 2',
        mmsi: '352002459',
        vesselType: 'Chemical Tanker',
        coordinates: [72.86, 19.11],
        speedKnots: 0.8,
        headingDeg: 35,
        incidentId: 'inc-2026-003',
        spillAreaKm2: 22.5,
        totalFineUSD: 165000,
        suspectScore: 0.69,
        status: 'monitored',
        detectedAt: '2026-08-22T03:00:00Z',
    },
    {
        id: 'vessel-311000109',
        shipName: 'Oceanic Quest',
        mmsi: '311000109',
        vesselType: 'Container Ship',
        coordinates: [72.58, 18.78],
        speedKnots: 14.7,
        headingDeg: 210,
        incidentId: 'inc-2026-001',
        spillAreaKm2: 14.8,
        totalFineUSD: 45000,
        suspectScore: 0.38,
        status: 'cleared',
        detectedAt: '2026-08-22T07:45:00Z',
    },
];
