import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { ScoreBar } from '@/ui/ScoreBar';
import { CheckCircle } from 'lucide-react';
import { SuspectPanel } from '@/features/suspect-ranking/SuspectPanel';

export const DetectionDrawer: React.FC = () => {
    const { selectedIncidentId, setSelectedIncidentId, isMockMode } = useUiStore();

    const { data: incidents } = useQuery({
        queryKey: ['incidents', isMockMode],
        queryFn: () => apiClient.getIncidents(isMockMode),
        enabled: !!selectedIncidentId,
    });

    const incident = incidents?.find((inc) => inc.id === selectedIncidentId);

    if (!selectedIncidentId || !incident) return null;

    const isWindArtifact = incident.windArtifactConfidence > 0.6;
    const timestampFormatted = new Date(incident.detectedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
    });

    // Calculate perimeter as relative layout measure
    const perimeter = incident.areaKm2 * incident.perimeterToAreaRatio * 3.5;

    return (
        <div className="absolute top-0 bottom-0 right-0 w-[400px] bg-[var(--panel)] border-l border-[var(--hairline)] flex flex-col shadow-[var(--shadow-drawer)] z-30 animate-fade-in">
            {/* Header */}
            <div className="h-16 border-b border-[var(--hairline)] px-6 flex items-center justify-between bg-[var(--panel)]">
                <div>
                    <span className="eyebrow block">DETECTION TARGET</span>
                    <h2 className="font-display font-medium text-lg text-[var(--foam)] tracking-wide">
                        {incident.id.toUpperCase()}
                    </h2>
                </div>
                <button
                    onClick={() => setSelectedIncidentId(null)}
                    className="text-xs eyebrow hover:text-[var(--foam)] transition-colors border border-[var(--hairline)] px-2.5 py-1 rounded-[var(--radius-chip)] bg-[var(--abyss)]"
                >
                    DISMISS PANEL
                </button>
            </div>

            {/* Scrollable Information Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Detection thumbnail simulator */}
                <div className="relative h-44 bg-[var(--abyss)] rounded-[var(--radius-card)] border border-[var(--hairline)] overflow-hidden flex items-center justify-center p-3">
                    {/* Mock Radar scan lines */}
                    <div className="absolute inset-0 bg-radial-grid opacity-20 pointer-events-none" />
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-[var(--slick-teal)] rounded-full animate-pulse opacity-15"
                        style={{ width: '120px', height: '120px' }}
                    />

                    {/* Dynamic miniature drawing of the polygon */}
                    <svg className="w-full h-full opacity-80" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                        <polyline
                            points="40,30 65,35 75,55 55,75 35,65 40,30"
                            fill="rgba(231,238,242,0.1)"
                            stroke="var(--foam)"
                            strokeWidth="2"
                        />
                        {isWindArtifact && (
                            <line x1="10" y1="20" x2="90" y2="80" stroke="var(--sonar-amber)" strokeWidth="0.5" strokeDasharray="3,3" />
                        )}
                    </svg>

                    {/* Watermark Tag */}
                    <span className="absolute bottom-2 right-2 text-[8px] font-mono text-[var(--foam-dim)] opacity-50">
                        SAR SENSING CAPTURE
                    </span>
                </div>

                {/* Analytics Card Group */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--abyss)] border border-[var(--hairline)] rounded-[var(--radius-card)]">
                        <span className="eyebrow block mb-1">TOTAL AREA</span>
                        <span className="data-value text-lg text-[var(--foam)] font-bold">
                            {incident.areaKm2.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal text-[var(--foam-dim)]">km²</span>
                        </span>
                    </div>
                    <div className="p-3 bg-[var(--abyss)] border border-[var(--hairline)] rounded-[var(--radius-card)]">
                        <span className="eyebrow block mb-1">EST. PERIMETER</span>
                        <span className="data-value text-lg text-[var(--foam)] font-bold">
                            {perimeter.toFixed(1)}{' '}
                            <span className="text-[10px] font-normal text-[var(--foam-dim)]">km</span>
                        </span>
                    </div>
                </div>

                {/* Remote Sensing & ML Pipeline Diagnostics */}
                <div className="space-y-2 border-t border-[var(--hairline)] pt-4">
                    <h3 className="font-display font-semibold text-[10px] tracking-wider text-[var(--foam-dim)] uppercase">
                        Remote Sensing & ML Pipeline
                    </h3>
                    <div className="bg-[var(--abyss)] p-3 border border-[var(--hairline)] rounded-[var(--radius-card)] space-y-2 text-[10px] font-mono">
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">PREPROCESSING:</span>
                            <span className="text-[var(--foam)]">LEE SPECKLE FILTER (7x7)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">MODEL INF ENGINE:</span>
                            <span className="text-[var(--foam)]">SEGFORMER-B3 (BACKSCATTER)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">ERA5 WIND SPEED:</span>
                            <span className={isWindArtifact ? "text-[var(--sonar-amber)] font-bold" : "text-[var(--slick-teal)] font-bold"}>
                                {isWindArtifact ? "1.2 M/S (LOOK-ALIKE CAUGHT)" : "4.8 M/S (VALID SLICK WINDOW)"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">GLCM TEXTURE CONTRAST:</span>
                            <span className="text-[var(--foam)]">{isWindArtifact ? "0.45 (LOW CALM)" : "1.25 (PETROLEUM ANOMALY)"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">GLCM HOMOGENEITY:</span>
                            <span className="text-[var(--foam)]">{isWindArtifact ? "0.95" : "0.88"}</span>
                        </div>
                    </div>
                </div>

                {/* Confidence metrics */}
                <div className="space-y-4 border-t border-[var(--hairline)] pt-4">
                    <ScoreBar
                        label="Wind Warping Artifact Prob (False Positive)"
                        score={incident.windArtifactConfidence}
                    />
                    {isWindArtifact && (
                        <div className="p-3 bg-[#F983E9]/10 border border-[#F983E9] rounded-[var(--radius-card)] text-xs text-[#F983E9] font-mono leading-relaxed">
                            ⚠️ HIGH FALSE POSITIVE PROBABILITY. Environmental look-alike likely. Wind velocity is below the 2.0 m/s threshold required to avoid biological films and low-wind ocean calm false detections.
                        </div>
                    )}
                </div>

                {/* Vessel attribution panel */}
                <div className="border-t border-[var(--hairline)] pt-4">
                    <SuspectPanel incidentId={selectedIncidentId} />
                </div>
            </div>

            {/* Drawer Action Bar */}
            <div className="h-14 border-t border-[var(--hairline)] px-6 flex items-center justify-between bg-[var(--abyss)] text-[10px] font-mono text-[var(--foam-dim)]">
                <span className="flex items-center">
                    <CheckCircle size={10} className="mr-1 text-[var(--slick-teal)]" />
                    VERIFIED SATELLITE METADATA
                </span>
                <span className="uppercase text-[var(--foam)] text-[9px]">{timestampFormatted}</span>
            </div>
        </div>
    );
};
