import React from 'react';
import { SuspectVessel } from '@/types/contract';
import { ScoreBar } from '@/ui/ScoreBar';

interface SuspectScoreBreakdownProps {
    vessel: SuspectVessel;
}

export const SuspectScoreBreakdown: React.FC<SuspectScoreBreakdownProps> = ({ vessel }) => {
    return (
        <div className="space-y-3 bg-[var(--abyss)] p-3.5 border border-[var(--hairline)] rounded-[var(--radius-card)] mt-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-[var(--foam-dim)] border-b border-[rgba(37,56,74,0.4)] pb-1.5 mb-2 uppercase">
                <span>Attribution Diagnostics</span>
                <span className="text-[var(--slick-teal)]">MMSI: {vessel.mmsi || 'N/A'}</span>
            </div>

            <ScoreBar
                label="Closeness to spill center (Spatial proximity)"
                score={vessel.minDistanceKm <= 0.5 ? 1.0 : Math.max(0.1, 1 - vessel.minDistanceKm / 10)}
            />

            <ScoreBar
                label="Temporal Overlap Match"
                score={Math.abs(vessel.temporalOverlapHours) <= 1.0 ? 1.0 : Math.max(0.1, 1 - Math.abs(vessel.temporalOverlapHours) / 12)}
            />

            <ScoreBar
                label="Flag risk weighting profile"
                score={vessel.vesselRiskWeight}
            />

            <ScoreBar
                label="AIS trajectory speed/course anomaly index"
                score={vessel.anomalyIndex}
            />
        </div>
    );
};
