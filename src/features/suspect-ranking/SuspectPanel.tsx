import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { SuspectScoreBreakdown } from './SuspectScoreBreakdown';
import { UserMinus, Anchor, FileText } from 'lucide-react';
import { DossierPreview } from '../dossier-export/DossierPreview';

interface SuspectPanelProps {
    incidentId: string;
}

export const SuspectPanel: React.FC<SuspectPanelProps> = ({ incidentId }) => {
    const { isMockMode, inspectedVesselMmsi, setInspectedVesselMmsi, isDossierOpen, setDossierOpen } = useUiStore();

    const { data: suspects, isLoading } = useQuery({
        queryKey: ['suspects', incidentId, isMockMode],
        queryFn: () => apiClient.getSuspects(incidentId, isMockMode),
        enabled: !!incidentId,
    });

    if (isLoading) {
        return <div className="text-xs font-mono text-[var(--foam-dim)] animate-pulse">Computing AIS proximity matrices...</div>;
    }

    // Top 5-8 limit to prevent clutter, sorted by score desc (PRD & Skill guidelines)
    const rankedSuspects = suspects ? [...suspects].sort((a, b) => b.suspectScore - a.suspectScore).slice(0, 5) : [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-xs tracking-wider text-[var(--foam-dim)] uppercase">
                    Vessel Attribution Ranking
                </h3>
                <Badge variant={inspectedVesselMmsi ? 'teal' : 'neutral'}>
                    {inspectedVesselMmsi ? '1 INSPECTED' : 'STBY'}
                </Badge>
            </div>

            {rankedSuspects.length === 0 ? (
                <p className="text-[11px] font-mono text-[var(--foam-dim)] opacity-65">No vessels located in proximity range of this detection corridor.</p>
            ) : (
                <div className="space-y-2.5">
                    {rankedSuspects.map((vessel) => {
                        const isInspected = vessel.mmsi === inspectedVesselMmsi;
                        const isDarkVessel = vessel.mmsi === null;

                        return (
                            <div key={vessel.mmsi || 'dark-vessel'} className="space-y-1.5 transition-all duration-200">
                                {/* Custom dashed-border card for Dark Vessel case (F7) */}
                                <Card
                                    interactive
                                    onClick={() => setInspectedVesselMmsi(isInspected ? null : vessel.mmsi)}
                                    className={`!p-3.5 relative overflow-hidden transition-all duration-200 ${isDarkVessel ? 'border-dashed border-[var(--signal-red)] bg-[rgba(225,72,60,0.03)]' : ''
                                        } ${isInspected
                                            ? 'border-[var(--slick-teal)] bg-[var(--panel-raised)]'
                                            : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            {isDarkVessel ? (
                                                <div className="flex items-center space-x-1 text-[9px] font-mono text-[var(--signal-red)] font-semibold tracking-wider uppercase mb-1.5">
                                                    <UserMinus size={10} />
                                                    <span>NO AIS MATCH (DARK VESSEL)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-1 text-[9px] font-mono text-[var(--foam-dim)] tracking-wider uppercase mb-1">
                                                    <Anchor size={9} />
                                                    <span>MMSI · {vessel.mmsi}</span>
                                                </div>
                                            )}
                                            <h4 className="font-display font-semibold text-sm max-w-[210px] truncate">
                                                {vessel.vesselName || 'UNKNOWN TRANSPONDER'}
                                            </h4>
                                            <p className="text-[10px] font-mono text-[var(--foam-dim)] opacity-70">
                                                Type: {vessel.vesselType} · Proximity: {vessel.minDistanceKm.toFixed(1)} km
                                            </p>
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-[9px] eyebrow">Score</span>
                                            <span
                                                className="data-value text-base font-bold"
                                                style={{
                                                    color:
                                                        vessel.suspectScore > 0.7
                                                            ? 'var(--signal-red)'
                                                            : vessel.suspectScore > 0.4
                                                                ? 'var(--sonar-amber)'
                                                                : 'var(--slick-teal)',
                                                }}
                                            >
                                                {(vessel.suspectScore * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Compact score indicator */}
                                    <div className="h-1 w-full bg-[var(--abyss)] rounded-full mt-2.5 overflow-hidden">
                                        <div
                                            className="h-full"
                                            style={{
                                                width: `${vessel.suspectScore * 100}%`,
                                                backgroundColor:
                                                    vessel.suspectScore > 0.7
                                                        ? 'var(--signal-red)'
                                                        : vessel.suspectScore > 0.4
                                                            ? 'var(--sonar-amber)'
                                                            : 'var(--slick-teal)',
                                            }}
                                        />
                                    </div>
                                </Card>

                                {/* Staggered diagnostic breakdown slider drawer (F6) */}
                                {isInspected && <SuspectScoreBreakdown vessel={vessel} />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Button to open dossier generation page */}
            <button
                onClick={() => setDossierOpen(true)}
                className="w-full bg-[var(--panel-raised)] hover:bg-[var(--hairline)] border border-[var(--hairline)] hover:border-[var(--foam-dim)] px-4 py-2.5 rounded-[var(--radius-card)] text-xs font-display font-semibold text-[var(--foam)] flex items-center justify-center space-x-2 transition-all duration-200"
            >
                <FileText size={13} className="text-[var(--slick-teal)]" />
                <span>PREVIEW & EXPORT EVIDENCE DOSSIER</span>
            </button>

            {/* Slide-over dossier panel */}
            {isDossierOpen && <DossierPreview incidentId={incidentId} onClose={() => setDossierOpen(false)} />}
        </div>
    );
};
export default SuspectPanel;
