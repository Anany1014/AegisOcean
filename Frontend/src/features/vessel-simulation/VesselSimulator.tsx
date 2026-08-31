/**
 * VesselSimulator.tsx
 * ───────────────────
 * Animated vessel path simulation panel.
 * Fetches /ml/simulate-index to list vessels from the new AIS CSV,
 * then plays back both actual (cyan) and Bi-LSTM predicted (violet) tracks
 * frame-by-frame on the map using deck.gl PathLayer data passed up via callback.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, X, Ship, ChevronDown, Radar } from 'lucide-react';

const ML_BASE = import.meta.env.VITE_ML_BASE_URL || 'http://localhost:8001';

interface VesselEntry {
    mmsi: string;
    vessel_name: string;
    vessel_type: string;
    risk_weight: number;
    ping_count: number;
    mean_error_km: number;
    anchor_lat: number;
    anchor_lon: number;
}

interface SimulationResult {
    mmsi: string;
    vessel_name: string;
    vessel_type: string;
    history_track: [number, number][];
    actual_track: [number, number][];
    predicted_track: [number, number][];
    actual_sogs: number[];
    predicted_sogs: number[];
    step_errors_km: number[];
    mean_error_km: number;
    anchor_lat: number;
    anchor_lon: number;
}

export interface SimulationState {
    historyPath: [number, number][];
    actualPath: [number, number][];
    predictedPath: [number, number][];
    markerPos: [number, number] | null;
    markerPos2: [number, number] | null;
    step: number;
    total: number;
}

interface VesselSimulatorProps {
    onSimulationUpdate: (state: SimulationState | null) => void;
    onFlyTo?: (lon: number, lat: number) => void;
}

export const VesselSimulator: React.FC<VesselSimulatorProps> = ({
    onSimulationUpdate,
    onFlyTo,
}) => {
    const [vessels, setVessels] = useState<VesselEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [indexError, setIndexError] = useState<string | null>(null);

    const [selectedMmsi, setSelectedMmsi] = useState<string>('');
    const [simResult, setSimResult] = useState<SimulationResult | null>(null);
    const [simLoading, setSimLoading] = useState(false);
    const [simError, setSimError] = useState<string | null>(null);

    const [step, setStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1); // steps per second
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [open, setOpen] = useState(true);

    // Fetch vessel index on mount
    useEffect(() => {
        setLoading(true);
        fetch(`${ML_BASE}/ml/simulate-index`)
            .then(r => r.json())
            .then(data => {
                setVessels(data.vessels || []);
                setLoading(false);
            })
            .catch(() => {
                setIndexError('ML server offline or notebook not run yet');
                setLoading(false);
            });
    }, []);

    // Run simulation for selected MMSI
    const runSimulation = useCallback(async () => {
        if (!selectedMmsi) return;
        setSimLoading(true);
        setSimError(null);
        setStep(0);
        setIsPlaying(false);
        onSimulationUpdate(null);
        try {
            const res = await fetch(`${ML_BASE}/ml/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mmsi: selectedMmsi, n_steps: 8 }),
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Simulation failed');
            const data: SimulationResult = await res.json();
            setSimResult(data);
            // Fly to anchor
            if (onFlyTo) onFlyTo(data.anchor_lon, data.anchor_lat);
            // Emit initial state
            onSimulationUpdate({
                historyPath: data.history_track,
                actualPath: [],
                predictedPath: [],
                markerPos: data.history_track[data.history_track.length - 1] || null,
                markerPos2: null,
                step: 0,
                total: data.actual_track.length,
            });
        } catch (e: any) {
            setSimError(e.message);
        }
        setSimLoading(false);
    }, [selectedMmsi]);

    // Playback loop
    useEffect(() => {
        if (!simResult) return;
        const total = simResult.actual_track.length;
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setStep(prev => {
                    const next = prev + 1;
                    if (next >= total) {
                        setIsPlaying(false);
                        return total - 1;
                    }
                    return next;
                });
            }, 1000 / speed);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isPlaying, simResult, speed]);

    // Emit map state on every step change
    useEffect(() => {
        if (!simResult) return;
        const s = step + 1; // steps revealed = step+1
        onSimulationUpdate({
            historyPath: simResult.history_track,
            actualPath: simResult.actual_track.slice(0, s),
            predictedPath: simResult.predicted_track.slice(0, s),
            markerPos: simResult.actual_track[step] || null,
            markerPos2: simResult.predicted_track[step] || null,
            step: step,
            total: simResult.actual_track.length,
        });
    }, [step, simResult]);

    const reset = () => {
        setStep(0);
        setIsPlaying(false);
    };

    const total = simResult?.actual_track.length || 0;
    const currentErr = simResult?.step_errors_km[step] ?? null;

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="absolute top-24 right-4 z-30 p-2.5 rounded-xl bg-[#0d1f35]/90 border border-[#b877ff]/30 text-[#b877ff] hover:bg-[#b877ff]/10 transition-all shadow-[0_0_16px_rgba(184,119,255,0.25)] backdrop-blur-md"
                title="Open Vessel Simulator"
            >
                <Radar size={18} />
            </button>
        );
    }

    return (
        <div className="absolute top-20 right-4 z-30 w-[320px] bg-[#08121e]/92 border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl font-mono overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#b877ff]/10">
                <div className="flex items-center space-x-2">
                    <Radar size={14} className="text-[#b877ff]" />
                    <span className="text-[10.5px] font-bold tracking-widest text-[#b877ff] uppercase">Vessel Path Simulation</span>
                </div>
                <button onClick={() => { setOpen(false); onSimulationUpdate(null); }} className="text-white/30 hover:text-white transition-colors">
                    <X size={13} />
                </button>
            </div>

            <div className="p-4 space-y-3">
                {/* Index status */}
                {loading && <div className="text-[9px] text-white/40 animate-pulse">Loading vessel index from ML server...</div>}
                {indexError && (
                    <div className="text-[9px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg px-2.5 py-2 leading-relaxed">
                        ⚠ {indexError}<br />
                        <span className="text-white/40">Run <code className="text-[#00f2fe]">vessel_simulation.ipynb</code> to generate the index, then restart the ML server.</span>
                    </div>
                )}

                {/* Vessel Selector */}
                {vessels.length > 0 && (
                    <div className="space-y-1.5">
                        <label className="text-[8.5px] text-white/40 uppercase tracking-wider">Select Vessel</label>
                        <div className="relative">
                            <select
                                value={selectedMmsi}
                                onChange={e => setSelectedMmsi(e.target.value)}
                                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-[10px] text-[var(--foam)] appearance-none outline-none focus:border-[#b877ff]/50 pr-8 cursor-pointer"
                            >
                                <option value="">— Choose a vessel —</option>
                                {vessels.map(v => (
                                    <option key={v.mmsi} value={v.mmsi}>
                                        {v.vessel_name || v.mmsi} · {v.vessel_type} · {v.mean_error_km.toFixed(2)} km err
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        </div>

                        {/* Selected vessel info */}
                        {selectedMmsi && (() => {
                            const v = vessels.find(x => x.mmsi === selectedMmsi);
                            if (!v) return null;
                            return (
                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                    {[
                                        { label: 'Type', value: v.vessel_type },
                                        { label: 'Pings', value: v.ping_count.toLocaleString() },
                                        { label: 'Model Err', value: `${v.mean_error_km.toFixed(2)} km` },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="bg-white/5 rounded-lg px-1.5 py-1.5 border border-white/5">
                                            <div className="text-[7.5px] text-white/40 uppercase">{label}</div>
                                            <div className="text-[9.5px] text-[#b877ff] font-semibold">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        <button
                            onClick={runSimulation}
                            disabled={!selectedMmsi || simLoading}
                            className="w-full py-2 rounded-lg bg-[#b877ff]/20 hover:bg-[#b877ff]/30 border border-[#b877ff]/40 text-[#b877ff] text-[10px] font-bold tracking-wider transition-all disabled:opacity-40 flex items-center justify-center space-x-2 cursor-pointer"
                        >
                            {simLoading
                                ? <><span className="animate-spin">⏳</span><span>LOADING...</span></>
                                : <><Ship size={12} /><span>LOAD SIMULATION</span></>}
                        </button>
                    </div>
                )}

                {simError && (
                    <div className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2">
                        ✗ {simError}
                    </div>
                )}

                {/* Playback controls */}
                {simResult && (
                    <div className="space-y-3 border-t border-white/10 pt-3">
                        {/* Track label */}
                        <div className="text-[9px] text-white/50 font-bold uppercase">
                            {simResult.vessel_name}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center space-x-3 text-[8.5px]">
                            <span className="flex items-center space-x-1"><span className="w-3 h-0.5 bg-[#00f2fe] inline-block" /><span className="text-white/50">Actual GPS</span></span>
                            <span className="flex items-center space-x-1"><span className="w-3 h-0.5 bg-[#b877ff] border-dashed inline-block border-b border-[#b877ff]" /><span className="text-white/50">Bi-LSTM Predicted</span></span>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5">
                            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#b877ff] to-[#00f2fe] rounded-full transition-all duration-300"
                                    style={{ width: `${total ? ((step + 1) / total) * 100 : 0}%` }} />
                            </div>
                            <div className="flex justify-between text-[8px] text-white/30">
                                <span>Step {step + 1} / {total}</span>
                                {currentErr !== null && (
                                    <span className={`font-semibold ${currentErr > 1.5 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
                                        Δ {currentErr.toFixed(2)} km
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Slider */}
                        <input
                            type="range" min={0} max={total - 1} value={step}
                            onChange={e => { setIsPlaying(false); setStep(Number(e.target.value)); }}
                            className="w-full h-3 opacity-0 absolute cursor-pointer"
                        />

                        {/* Controls */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <button
                                    onClick={() => setIsPlaying(p => !p)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all ${
                                        isPlaying
                                            ? 'bg-[#f59e0b] text-[#0b1724] shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                                            : 'bg-[#b877ff] text-white shadow-[0_0_10px_rgba(184,119,255,0.4)]'
                                    }`}
                                >
                                    {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                </button>
                                <button onClick={reset} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white flex items-center justify-center transition-colors">
                                    <RotateCcw size={12} />
                                </button>
                            </div>

                            {/* Speed */}
                            <div className="flex items-center space-x-0.5 bg-black/40 border border-white/10 rounded-lg p-0.5">
                                {[0.5, 1, 2].map(s => (
                                    <button key={s} onClick={() => setSpeed(s)}
                                        className={`px-2 py-0.5 rounded text-[8.5px] font-bold transition-all ${speed === s ? 'bg-[#b877ff] text-white' : 'text-white/40 hover:text-white'}`}>
                                        {s}×
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step error chart */}
                        {simResult.step_errors_km.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-[7.5px] text-white/30 uppercase tracking-wider">Haversine Error per Step</span>
                                <div className="flex items-end space-x-0.5 h-10">
                                    {simResult.step_errors_km.map((err, i) => {
                                        const maxErr = Math.max(...simResult.step_errors_km, 0.1);
                                        const h = (err / maxErr) * 100;
                                        return (
                                            <div key={i} className="relative flex-1 group">
                                                <div
                                                    className={`w-full rounded-t transition-all ${i === step ? 'opacity-100' : 'opacity-50'}`}
                                                    style={{
                                                        height: `${h}%`,
                                                        background: err > 1.5 ? '#f59e0b' : err > 0.8 ? '#b877ff' : '#00f2fe',
                                                        minHeight: '3px',
                                                    }}
                                                />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block text-[7px] bg-black/80 text-white px-1 py-0.5 rounded whitespace-nowrap z-50">
                                                    +{i+1}: {err.toFixed(2)} km
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-[7px] text-white/20">
                                    <span>+1</span><span>+{simResult.step_errors_km.length}</span>
                                </div>
                            </div>
                        )}

                        {/* SOG comparison */}
                        {simResult.actual_sogs.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 text-center border-t border-white/5 pt-2">
                                <div className="bg-black/30 rounded-lg px-2 py-1.5 border border-[#00f2fe]/20">
                                    <div className="text-[7.5px] text-[#00f2fe]/60 uppercase">Actual SOG</div>
                                    <div className="text-[13px] font-bold text-[#00f2fe]">{(simResult.actual_sogs[step] ?? 0).toFixed(1)} kn</div>
                                </div>
                                <div className="bg-black/30 rounded-lg px-2 py-1.5 border border-[#b877ff]/20">
                                    <div className="text-[7.5px] text-[#b877ff]/60 uppercase">Predicted SOG</div>
                                    <div className="text-[13px] font-bold text-[#b877ff]">{(simResult.predicted_sogs[step] ?? 0).toFixed(1)} kn</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Index available info */}
                {vessels.length > 0 && !simResult && (
                    <div className="text-center text-[8px] text-white/20 pt-1">
                        {vessels.length} vessels indexed · Bi-LSTM Seq2Seq · ~1 km mean error
                    </div>
                )}
            </div>
        </div>
    );
};
