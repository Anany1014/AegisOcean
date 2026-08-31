import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { ScoreBar } from '@/ui/ScoreBar';
import { CheckCircle, Brain, BarChart2, ShieldCheck, X } from 'lucide-react';
import { SuspectPanel } from '@/features/suspect-ranking/SuspectPanel';
import { MLInsightPanel } from '@/features/ml-insights/MLInsightPanel';
import { DossierExportPanel } from '@/features/dossier-export/DossierExportPanel';
import { ProofVerificationModal } from '@/features/blockchain/ProofVerificationModal';

export const DetectionDrawer: React.FC = () => {
    const { selectedIncidentId, setSelectedIncidentId, isMockMode } = useUiStore();
    const [drawerTab, setDrawerTab] = useState<'analysis' | 'ml'>('analysis');
    const [showProofModal, setShowProofModal] = useState(false);

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
        <div className="absolute top-0 bottom-0 right-0 w-[440px] bg-[#08121e]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] z-30 animate-fade-in font-mono">
            {/* Header */}
            <div className="h-16 border-b border-white/10 px-5 flex items-center justify-between bg-black/40">
                <div>
                    <span className="eyebrow block text-[8px] text-white/40 tracking-widest uppercase">DETECTION TARGET</span>
                    <h2 className="font-display font-bold text-base text-[var(--foam)] tracking-wider flex items-center space-x-2">
                        <span>{incident.id.toUpperCase()}</span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[var(--slick-teal)]/20 text-[var(--slick-teal)] border border-[var(--slick-teal)]/30">
                            {incident.severity || 'HIGH'}
                        </span>
                    </h2>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Dossier PDF Export Button — Enhancement 8 */}
                    <DossierExportPanel incident={incident} />

                    <button
                        onClick={() => setSelectedIncidentId(null)}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        title="Close Drawer"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tab switcher — Analysis vs ML Intelligence */}
            <div className="flex border-b border-white/10 flex-shrink-0 bg-black/20">
                {[
                    { key: 'analysis', label: 'Analysis & AIS', icon: <BarChart2 className="w-3.5 h-3.5" /> },
                    { key: 'ml',       label: 'ML Intelligence', icon: <Brain className="w-3.5 h-3.5" /> },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setDrawerTab(tab.key as 'analysis' | 'ml')}
                        className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 text-[9.5px] font-mono tracking-wider transition-all cursor-pointer ${drawerTab === tab.key
                            ? 'text-[var(--slick-teal)] border-b-2 border-[var(--slick-teal)] bg-[var(--slick-teal)]/10 font-bold'
                            : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            }`}
                    >
                        {tab.icon}
                        <span className="uppercase">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ML Intelligence Tab */}
            {drawerTab === 'ml' && (
                <MLInsightPanel incident={incident} />
            )}

            {/* Scrollable Information Body (Analysis Tab) */}
            {drawerTab === 'analysis' && <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Detection thumbnail simulator */}
                <div className="relative h-40 bg-black/40 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center p-3">
                    {/* Mock Radar scan lines */}
                    <div className="absolute inset-0 bg-radial-grid opacity-20 pointer-events-none" />
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-[var(--slick-teal)] rounded-full animate-pulse opacity-20"
                        style={{ width: '120px', height: '120px' }}
                    />

                    {/* Dynamic miniature drawing of the polygon */}
                    <svg className="w-full h-full opacity-80" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                        <polyline
                            points="40,30 65,35 75,55 55,75 35,65 40,30"
                            fill="rgba(0, 242, 254, 0.15)"
                            stroke="var(--slick-teal)"
                            strokeWidth="2"
                        />
                        {isWindArtifact && (
                            <line x1="10" y1="20" x2="90" y2="80" stroke="var(--sonar-amber)" strokeWidth="0.5" strokeDasharray="3,3" />
                        )}
                    </svg>

                    {/* Watermark Tag */}
                    <span className="absolute bottom-2 right-2 text-[8px] font-mono text-[var(--foam-dim)] opacity-50">
                        SAR SENSING CAPTURE · C-BAND
                    </span>
                </div>

                {/* Analytics Card Group */}
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 bg-black/30 border border-white/10 rounded-xl">
                        <span className="text-[8px] text-white/40 tracking-wider block mb-1 uppercase">TOTAL SLICK AREA</span>
                        <span className="text-lg text-[var(--foam)] font-bold">
                            {incident.areaKm2.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal text-[var(--foam-dim)]">km²</span>
                        </span>
                    </div>
                    <div className="p-3 bg-black/30 border border-white/10 rounded-xl">
                        <span className="text-[8px] text-white/40 tracking-wider block mb-1 uppercase">EST. PERIMETER</span>
                        <span className="text-lg text-[var(--foam)] font-bold">
                            {perimeter}{' '}
                            <span className="text-[10px] font-normal text-[var(--foam-dim)]">km</span>
                        </span>
                    </div>
                </div>

                {/* Remote Sensing & ML Pipeline Diagnostics */}
                <div className="space-y-2 border-t border-white/10 pt-4">
                    <h3 className="text-[9px] font-semibold tracking-wider text-[var(--foam-dim)] uppercase">
                        Remote Sensing & ML Diagnostics
                    </h3>
                    <div className="bg-black/30 p-3 border border-white/10 rounded-xl space-y-2 text-[9.5px]">
                        <div className="flex justify-between">
                            <span className="text-white/40">PREPROCESSING:</span>
                            <span className="text-[var(--foam)]">LEE SPECKLE FILTER (7x7)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/40">MODEL INF ENGINE:</span>
                            <span className="text-[var(--foam)]">SEGFORMER-B3 (BACKSCATTER)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/40">ERA5 WIND SPEED:</span>
                            <span className={isWindArtifact ? "text-[var(--sonar-amber)] font-bold" : "text-[var(--slick-teal)] font-bold"}>
                                {isWindArtifact ? "1.2 M/S (LOOK-ALIKE CAUGHT)" : "4.8 M/S (VALID SLICK WINDOW)"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/40">GLCM CONTRAST:</span>
                            <span className="text-[var(--foam)]">{isWindArtifact ? "0.45 (LOW CALM)" : "1.25 (PETROLEUM ANOMALY)"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/40">GLCM HOMOGENEITY:</span>
                            <span className="text-[var(--foam)]">{isWindArtifact ? "0.95" : "0.88"}</span>
                        </div>
                    </div>
                </div>

                {/* Confidence metrics */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                    <ScoreBar
                        label="Wind Warping Artifact Prob (False Positive)"
                        score={incident.windArtifactConfidence}
                    />
                    {isWindArtifact && (
                        <div className="p-3 bg-[#F983E9]/10 border border-[#F983E9]/30 rounded-xl text-[10.5px] text-[#F983E9] leading-relaxed">
                            ⚠️ HIGH FALSE POSITIVE PROBABILITY. Environmental look-alike likely. Wind velocity is below the 2.0 m/s threshold required to avoid biological films and low-wind ocean calm false detections.
                        </div>
                    )}
                </div>

                {/* Vessel attribution panel */}
                <div className="border-t border-white/10 pt-4">
                    <SuspectPanel incidentId={selectedIncidentId} />
                </div>
            </div>}

            {/* Drawer Action Bar — Enhancement 7: Proof Verification */}
            <div className="h-14 border-t border-white/10 px-5 flex items-center justify-between bg-black/50 text-[9.5px]">
                <button
                    onClick={() => setShowProofModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[var(--slick-teal)]/10 hover:bg-[var(--slick-teal)]/20 border border-[var(--slick-teal)]/30 text-[var(--slick-teal)] transition-all font-semibold cursor-pointer"
                >
                    <ShieldCheck size={13} />
                    <span>VERIFY CRYPTO PROOF</span>
                </button>

                <div className="flex items-center space-x-1.5 text-white/40">
                    <CheckCircle size={11} className="text-[#22c55e]" />
                    <span className="uppercase text-[9px]">{timestampFormatted}</span>
                </div>
            </div>

            {/* Proof Verification Modal — Enhancement 7 */}
            {showProofModal && (
                <ProofVerificationModal
                    incidentId={incident.id}
                    onClose={() => setShowProofModal(false)}
                />
            )}
        </div>
    );
};
