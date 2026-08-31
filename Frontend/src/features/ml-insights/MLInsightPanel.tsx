import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mlClient } from '@/lib/mlClient';
import { Incident } from '@/types/contract';
import type { SuspectScoreResponse } from '@/types/ml';
import {
    Brain, Radio, AlertTriangle, CheckCircle,
    Zap, Ship, EyeOff, TrendingUp, Target, Activity,
    ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';


// ── Sub-components ────────────────────────────────────────────────────────────

const Meter: React.FC<{ value: number; color: string; label?: string }> = ({ value, color, label }) => (
    <div className="space-y-0.5">
        {label && <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</span>}
        <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{ width: `${Math.round(value * 100)}%`, background: color }}
            />
        </div>
        <span className="text-[10px] font-mono font-semibold" style={{ color }}>{(value * 100).toFixed(1)}%</span>
    </div>
);

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
    const pct = score * 100;
    const [bg, label] = pct >= 75 ? ['#ff4d4d', 'CRITICAL'] :
        pct >= 50 ? ['#f59e0b', 'HIGH'] :
            pct >= 30 ? ['#3b82f6', 'MEDIUM'] : ['#22c55e', 'LOW'];
    return (
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: bg + '33', color: bg, border: `1px solid ${bg}55` }}>
            {label} · {pct.toFixed(1)}%
        </span>
    );
};

// ── SAR Classification Panel ─────────────────────────────────────────────────

const SARClassificationCard: React.FC<{ incident: Incident }> = ({ incident }) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['sar-classify', incident.id],
        queryFn: () => mlClient.classifySAR({
            incident_id: incident.id,
            area_km2: incident.areaKm2,
            perimeter_to_area_ratio: incident.perimeterToAreaRatio,
            wind_artifact_confidence: incident.windArtifactConfidence,
        }),
        staleTime: 60_000,
    });

    if (isLoading) return (
        <div className="flex items-center space-x-2 p-3 text-[10px] font-mono text-white/40">
            <Loader2 className="w-3 h-3 animate-spin text-[var(--slick-teal)]" />
            <span>Running SAR Classifier (EfficientNet-B2, Epoch 49)...</span>
        </div>
    );

    if (error || !data) return null;

    const ringColor = data.is_oil
        ? (data.oil_probability > 0.85 ? '#ff4d4d' : '#f59e0b')
        : '#22c55e';
    const statusIcon = data.is_oil ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />;
    const statusText = data.is_oil ? 'OIL SLICK DETECTED' : 'LOOK-ALIKE / CLEAN SEA';

    return (
        <div className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--abyss)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--hairline)]"
                style={{ background: ringColor + '14' }}>
                <div className="flex items-center space-x-2" style={{ color: ringColor }}>
                    {statusIcon}
                    <span className="text-[10px] font-mono font-bold tracking-wider">{statusText}</span>
                </div>
                <span className="text-[9px] font-mono text-white/40">SAR ML · Epoch {data.model_epoch}</span>
            </div>

            <div className="p-3 space-y-3">
                {/* Probability gauge */}
                <div className="flex items-center space-x-3">
                    {/* Radial gauge */}
                    <div className="relative flex-shrink-0">
                        <svg width="56" height="56" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                            <circle
                                cx="28" cy="28" r="22" fill="none"
                                stroke={ringColor} strokeWidth="5"
                                strokeDasharray={`${data.oil_probability * 138.2} 138.2`}
                                strokeLinecap="round"
                                transform="rotate(-90 28 28)"
                                className="transition-all duration-700"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[11px] font-mono font-bold" style={{ color: ringColor }}>
                                {(data.oil_probability * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-1.5">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono text-white/40 uppercase">Oil Probability</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-[3px]"
                                style={{ background: ringColor + '25', color: ringColor }}>
                                {data.confidence_class}
                            </span>
                        </div>
                        <Meter value={data.oil_probability} color={ringColor} />
                        <div className="flex justify-between text-[9px] font-mono text-white/30">
                            <span>Threshold: {data.threshold_used} (Youden's J)</span>
                        </div>
                    </div>
                </div>

                {/* Feature breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--hairline)]">
                    {[
                        { label: 'Area', value: `${incident.areaKm2} km²`, icon: <Target className="w-3 h-3" /> },
                        { label: 'PAR', value: incident.perimeterToAreaRatio.toFixed(2), icon: <Activity className="w-3 h-3" /> },
                        { label: 'Wind Conf', value: `${(incident.windArtifactConfidence * 100).toFixed(0)}%`, icon: <TrendingUp className="w-3 h-3" /> },
                    ].map(({ label, value, icon }) => (
                        <div key={label} className="flex flex-col items-center space-y-1 text-center">
                            <span className="text-white/30">{icon}</span>
                            <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
                            <span className="text-[11px] font-mono font-semibold text-[var(--foam)]">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Bonn Agreement Classification */}
                {data.bonn_class && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-[var(--radius-chip)] bg-[#ff4d4d14] border border-[#ff4d4d33]">
                        <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Bonn Agreement</span>
                        <span className="text-[10px] font-mono font-bold text-[#ff4d4d]">{data.bonn_class}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── AIS Vessel Score Cards ────────────────────────────────────────────────────

const VesselSuspectCard: React.FC<{ vessel: SuspectScoreResponse; rank: number }> = ({ vessel, rank }) => {
    const [expanded, setExpanded] = useState(rank === 1);

    const isDark = !vessel.mmsi;
    const accentColor = vessel.suspect_score > 0.75 ? '#ff4d4d' :
        vessel.suspect_score > 0.5 ? '#f59e0b' :
            vessel.suspect_score > 0.3 ? '#3b82f6' : '#22c55e';

    const scoreBreakdown = [
        { label: 'Proximity', value: vessel.observed_prox_km != null ? Math.max(0, 1 - vessel.observed_prox_km / 50) : 0, color: '#ff4d4d' },
        { label: 'Dark Flag', value: vessel.dark_vessel_flag, color: '#f59e0b' },
        { label: 'Type Risk', value: vessel.vessel_risk, color: '#a855f7' },
        { label: 'Speed Drop', value: vessel.speed_drop_score, color: '#3b82f6' },
    ];

    return (
        <div className="rounded-[var(--radius-card)] border overflow-hidden transition-all duration-200"
            style={{ borderColor: accentColor + '44', background: accentColor + '09' }}>
            {/* Rank header */}
            <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono"
                        style={{ background: accentColor + '33', color: accentColor }}>
                        {rank}
                    </div>
                    {isDark
                        ? <EyeOff className="w-3.5 h-3.5 text-[#f59e0b]" />
                        : <Ship className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    }
                    <div>
                        <div className="text-[10px] font-mono font-semibold text-[var(--foam)]">{vessel.vessel_name}</div>
                        <div className="text-[8px] font-mono text-white/40">{vessel.vessel_type}</div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <ScoreBadge score={vessel.suspect_score} />
                    {expanded ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-[var(--hairline)]">
                    {/* MMSI / IMO */}
                    <div className="flex items-center justify-between pt-2 text-[9px] font-mono">
                        <span className="text-white/40">MMSI</span>
                        <span className={`font-semibold ${isDark ? 'text-[#f59e0b]' : 'text-[var(--slick-teal)]'}`}>
                            {vessel.mmsi ?? 'DARK — NO TRANSPONDER'}
                        </span>
                    </div>

                    {/* Dark vessel flag */}
                    {vessel.dark_vessel_flag === 1 && (
                        <div className="flex items-center space-x-2 px-2 py-1.5 rounded-[var(--radius-chip)] bg-[#f59e0b14] border border-[#f59e0b33]">
                            <EyeOff className="w-3 h-3 text-[#f59e0b] flex-shrink-0" />
                            <span className="text-[9px] font-mono text-[#f59e0b]">
                                AIS DARK — Transmission gap &gt;30 min near spill window
                            </span>
                        </div>
                    )}

                    {/* Score bars */}
                    <div className="space-y-2">
                        {scoreBreakdown.map(({ label, value, color }) => (
                            <Meter key={label} label={label} value={value} color={color} />
                        ))}
                    </div>

                    {/* Distance metrics */}
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                        <div className="rounded-[var(--radius-chip)] bg-white/5 px-2 py-1.5 space-y-0.5">
                            <div className="text-white/40 uppercase text-[8px]">Observed Prox</div>
                            <div className="font-semibold text-[var(--foam)]">
                                {vessel.observed_prox_km != null ? `${vessel.observed_prox_km} km` : '—'}
                            </div>
                        </div>
                        <div className="rounded-[var(--radius-chip)] bg-white/5 px-2 py-1.5 space-y-0.5">
                            <div className="text-white/40 uppercase text-[8px]">LSTM Predicted Prox</div>
                            <div className="font-semibold text-[var(--slick-teal)]">
                                {vessel.predicted_prox_km != null ? `${vessel.predicted_prox_km} km` : 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Predicted track coordinates */}
                    {vessel.predicted_track.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
                                LSTM Predicted Path ({vessel.predicted_track.length} steps · ~1km error)
                            </span>
                            <div className="max-h-20 overflow-y-auto space-y-0.5">
                                {vessel.predicted_track.map((pt, i) => (
                                    <div key={i} className="flex items-center space-x-2 text-[8px] font-mono text-white/40">
                                        <span className="text-white/20">+{i + 1}</span>
                                        <span>{pt.lat.toFixed(4)}°N</span>
                                        <span>{pt.lon.toFixed(4)}°E</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main ML Insight Panel ─────────────────────────────────────────────────────

interface MLInsightPanelProps {
    incident: Incident;
}

export const MLInsightPanel: React.FC<MLInsightPanelProps> = ({ incident }) => {
    const [serverOnline, setServerOnline] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<'sar' | 'ais'>('sar');

    // ── Health check ──
    useEffect(() => {
        mlClient.health()
            .then(() => setServerOnline(true))
            .catch(() => setServerOnline(false));
    }, []);

    // ── Suspect scores ──
    const spillCentroid = incident.centroid ?? [
        (incident.polygon.coordinates[0].reduce((s, c) => s + c[0], 0) / incident.polygon.coordinates[0].length),
        (incident.polygon.coordinates[0].reduce((s, c) => s + c[1], 0) / incident.polygon.coordinates[0].length),
    ];

    const { data: suspects, isLoading: suspectsLoading } = useQuery({
        queryKey: ['ml-suspects', incident.id],
        queryFn: () => mlClient.scoreSuspects({
            spill_lat: spillCentroid[1],
            spill_lon: spillCentroid[0],
            spill_time_iso: incident.detectedAt,
            vessels: [],  // uses mock data fallback
            proximity_radius_km: 50.0,
        }),
        staleTime: 60_000,
    });

    return (
        <div className="flex flex-col h-full font-mono">
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--hairline)] flex-shrink-0">
                <div className="flex items-center space-x-2">
                    <Brain className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span className="text-[10px] font-bold tracking-wider text-[var(--foam)] uppercase">ML Intelligence</span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${serverOnline === true ? 'bg-[var(--slick-teal)] animate-pulse' : serverOnline === false ? 'bg-red-500' : 'bg-white/20'}`} />
                    <span className="text-[8px] text-white/40">
                        {serverOnline === true ? 'LIVE · :8001' : serverOnline === false ? 'MOCK DATA' : 'CONNECTING...'}
                    </span>
                </div>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-[var(--hairline)] flex-shrink-0">
                {[
                    { key: 'sar', label: 'SAR Classifier', icon: <Radio className="w-3 h-3" /> },
                    { key: 'ais', label: 'AIS Predictor', icon: <Ship className="w-3 h-3" /> },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as 'sar' | 'ais')}
                        className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-[9px] tracking-wider transition-colors cursor-pointer
                            ${activeTab === tab.key
                                ? 'text-[var(--slick-teal)] border-b-2 border-[var(--slick-teal)] bg-[var(--slick-teal)]/5'
                                : 'text-white/40 hover:text-white/70'
                            }`}
                    >
                        {tab.icon}
                        <span className="uppercase">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">

                {activeTab === 'sar' && (
                    <div className="space-y-3">
                        {/* Model info banner */}
                        <div className="flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-chip)] bg-[#a855f7]/10 border border-[#a855f7]/25">
                            <Zap className="w-3 h-3 text-[#a855f7] flex-shrink-0" />
                            <div className="text-[8px] text-[#a855f7]/80 leading-relaxed">
                                <strong>EfficientNet-B2</strong> transfer-learned on CSIRO Sentinel-1 chips.<br />
                                F1: <strong>94.4%</strong> · AUC: <strong>99.4%</strong> · Threshold: <strong>0.5315</strong> (Youden's J)
                            </div>
                        </div>

                        {/* Classification result */}
                        <SARClassificationCard incident={incident} />

                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            {[
                                { label: 'Test F1', value: '94.4%', color: '#22c55e' },
                                { label: 'AUC-ROC', value: '99.4%', color: '#3b82f6' },
                                { label: 'Catch Rate', value: '95.1%', color: '#a855f7' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="rounded-[var(--radius-chip)] bg-white/5 px-2 py-2 space-y-0.5">
                                    <div className="text-[8px] text-white/40 uppercase tracking-wider">{label}</div>
                                    <div className="text-[13px] font-bold" style={{ color }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'ais' && (
                    <div className="space-y-3">
                        {/* Model info banner */}
                        <div className="flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-chip)] bg-[#00f2fe]/10 border border-[#00f2fe]/25">
                            <Activity className="w-3 h-3 text-[var(--slick-teal)] flex-shrink-0" />
                            <div className="text-[8px] text-[var(--slick-teal)]/80 leading-relaxed">
                                <strong>Bi-LSTM Seq2Seq</strong> + Bahdanau Attention. Trained on 15,241 vessels.<br />
                                Mean Error: <strong>1.007 km</strong> · Median: <strong>137 m</strong> · SOG MAE: <strong>0.40 kn</strong>
                            </div>
                        </div>

                        {/* Suspect ranking */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-white/40 uppercase tracking-wider">Suspect Vessels · {incident.id}</span>
                                {suspectsLoading && <Loader2 className="w-3 h-3 animate-spin text-[var(--slick-teal)]" />}
                            </div>
                            {suspects && suspects.map((v, i) => (
                                <VesselSuspectCard key={v.mmsi ?? i} vessel={v} rank={i + 1} />
                            ))}
                        </div>

                        {/* Performance summary */}
                        <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-[var(--hairline)]">
                            {[
                                { label: 'Path Accuracy', value: '~1 km', sub: 'mean test error', color: '#00f2fe' },
                                { label: 'Median Error', value: '137 m', sub: 'typical voyage', color: '#22c55e' },
                                { label: 'Speed MAE', value: '0.40 kn', sub: 'SOG tracking', color: '#a855f7' },
                                { label: 'Vessels Trained', value: '15,241', sub: '1-day AIS', color: '#f59e0b' },
                            ].map(({ label, value, sub, color }) => (
                                <div key={label} className="rounded-[var(--radius-chip)] bg-white/5 px-2 py-2 space-y-0.5">
                                    <div className="text-[8px] text-white/40 uppercase tracking-wider">{label}</div>
                                    <div className="text-[12px] font-bold" style={{ color }}>{value}</div>
                                    <div className="text-[8px] text-white/25">{sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
