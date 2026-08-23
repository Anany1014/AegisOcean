import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { SuspectScoreBreakdown } from './SuspectScoreBreakdown';
import { UserMinus, Anchor, FileText, ShieldAlert, Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { DossierPreview } from '../dossier-export/DossierPreview';

interface SuspectPanelProps {
    incidentId: string;
}

export const SuspectPanel: React.FC<SuspectPanelProps> = ({ incidentId }) => {
    const {
        isMockMode,
        inspectedVesselMmsi,
        setInspectedVesselMmsi,
        isDossierOpen,
        setDossierOpen,
        fineEnforcedIncidents,
        enforceFine
    } = useUiStore();

    const [isEnforcing, setIsEnforcing] = useState(false);
    const [enforceProgress, setEnforceProgress] = useState('');

    // Fetch incident details to compute fine
    const { data: incidents } = useQuery({
        queryKey: ['incidents', isMockMode],
        queryFn: () => apiClient.getIncidents(isMockMode),
    });

    const activeIncident = incidents?.find((inc) => inc.id === incidentId);
    const areaKm2 = activeIncident?.areaKm2 || 0;
    const marpolFine = 50000 + areaKm2 * 10000;

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
    const topVessel = rankedSuspects[0];

    const enforcedRecord = fineEnforcedIncidents[incidentId];

    const handleEnforce = async () => {
        setIsEnforcing(true);
        setEnforceProgress('Simulating private key authentication...');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setEnforceProgress('Pinning forensics GeoTIFF & AIS telemetry to IPFS...');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setEnforceProgress('Broadcasting statutory fine tx to Polygon Amoy Testnet...');
        await enforceFine(incidentId, topVessel ? topVessel.mmsi : null, areaKm2);
        setIsEnforcing(false);
        setEnforceProgress('');
    };

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
                        const isVesselEnforced = enforcedRecord && (enforcedRecord.vesselMmsi === vessel.mmsi);

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
                                                <div className="flex items-center space-x-2 text-[9px] font-mono text-[var(--foam-dim)] tracking-wider uppercase mb-1">
                                                    <div className="flex items-center space-x-1">
                                                        <Anchor size={9} />
                                                        <span>MMSI · {vessel.mmsi}</span>
                                                    </div>
                                                    {isVesselEnforced && (
                                                        <span className="px-1.5 py-0.5 bg-[var(--signal-red)] text-white text-[8px] font-bold rounded">PORT HOLD</span>
                                                    )}
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

            {/* Web3 Port State Control fine enforcement card */}
            <div className="bg-[var(--panel-raised)] p-4 border border-[var(--hairline)] rounded-[var(--radius-card)] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <ShieldAlert size={14} className={enforcedRecord ? "text-[var(--slick-teal)] animate-pulse" : "text-[var(--sonar-amber)]"} />
                        <h4 className="font-display font-semibold text-[10px] tracking-wider text-[var(--foam)] uppercase">
                            PORT STATE CONTROL GATEWAY
                        </h4>
                    </div>
                    <Badge variant={enforcedRecord ? 'teal' : 'neutral'}>
                        {enforcedRecord ? 'ON-CHAIN HOLD' : 'STANDBY'}
                    </Badge>
                </div>

                <div className="bg-[var(--abyss)] p-3 border border-[var(--hairline)] rounded-[var(--radius-card)] space-y-2">
                    <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[var(--foam-dim)]">STATUTORY BASE:</span>
                        <span className="text-[var(--foam)] font-semibold">$50,000 USD</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[var(--foam-dim)]">SPILL AREA SPLICING:</span>
                        <span className="text-[var(--foam)] font-semibold">{areaKm2.toFixed(2)} km² x $10,000</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono border-t border-[var(--hairline)] pt-1.5 font-bold">
                        <span className="text-[var(--foam-dim)]">TOTAL FINE VALUE:</span>
                        <span className="text-[var(--signal-red)]">${marpolFine.toLocaleString()} USD</span>
                    </div>
                </div>

                {isEnforcing ? (
                    <div className="p-3 bg-[var(--abyss)] border border-[var(--hairline)] rounded-[var(--radius-card)] flex flex-col items-center justify-center space-y-2">
                        <Loader2 size={16} className="animate-spin text-[var(--slick-teal)]" />
                        <span className="text-[9px] font-mono text-[var(--foam-dim)] text-center animate-pulse uppercase">
                            {enforceProgress}
                        </span>
                    </div>
                ) : enforcedRecord ? (
                    <div className="p-3 bg-[var(--abyss)] border border-[var(--slick-teal)]/30 rounded-[var(--radius-card)] space-y-2 text-[9px] font-mono">
                        <div className="flex items-center space-x-1.5 text-[var(--slick-teal)] font-bold mb-1">
                            <CheckCircle2 size={12} />
                            <span>FINE TRANSACTION CONFIRMED ON POLYGON</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">TX HASH:</span>
                            <span className="text-[var(--foam)] truncate max-w-[150px] underline hover:text-[var(--slick-teal)] flex items-center" title={enforcedRecord.txHash}>
                                {enforcedRecord.txHash.slice(0, 8)}...{enforcedRecord.txHash.slice(-6)}
                                <Link2 size={10} className="ml-1" />
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">IPFS CID:</span>
                            <a href={`https://gateway.ipfs.io/ipfs/${enforcedRecord.ipfsCid}`} target="_blank" rel="noreferrer" className="text-[var(--foam)] underline hover:text-[var(--slick-teal)] flex items-center">
                                {enforcedRecord.ipfsCid.slice(0, 6)}...{enforcedRecord.ipfsCid.slice(-6)}
                                <Link2 size={10} className="ml-1 text-[var(--slick-teal)]" />
                            </a>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">BLOCK NUMBER:</span>
                            <span className="text-[var(--foam)]">#{enforcedRecord.blockNumber}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foam-dim)]">PORT STATUS:</span>
                            <span className="text-[var(--signal-red)] font-bold uppercase animate-pulse">CLEARANCE HOLD ACTIVE</span>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleEnforce}
                        disabled={!topVessel}
                        className="w-full bg-[var(--signal-red)] hover:bg-[#c53030] disabled:bg-gray-800 disabled:opacity-45 text-white py-2 px-4 rounded-[var(--radius-card)] text-xs font-display font-semibold transition-all duration-200 uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
                    >
                        <span>ENFORCE STATUTORY FINE ON BLOCKCHAIN</span>
                    </button>
                )}
            </div>

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
