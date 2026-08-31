import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Navigation, SkipBack, SkipForward, Activity } from 'lucide-react';
import { useDriftPlaybackStore } from '@/stores/useDriftPlaybackStore';

export const DriftScrubber: React.FC = () => {
    const {
        driftPlayhead,
        isPlaying,
        isForecastMode,
        setDriftPlayhead,
        setForecastMode,
        togglePlaying,
    } = useDriftPlaybackStore();

    const [speed, setSpeed] = useState<number>(1); // 0.5, 1, 2, 5
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const minVal = isForecastMode ? 0 : -72;
    const maxVal = isForecastMode ? 48 : 0;
    const step = isForecastMode ? 12 : 24;

    // Step handlers
    const handleStepBack = () => {
        setDriftPlayhead(Math.max(minVal, driftPlayhead - step));
    };

    const handleStepForward = () => {
        setDriftPlayhead(Math.min(maxVal, driftPlayhead + step));
    };

    // Playback timer loop with dynamic speed
    useEffect(() => {
        if (isPlaying) {
            const baseInterval = 1500;
            const dynamicInterval = Math.round(baseInterval / speed);

            intervalRef.current = setInterval(() => {
                const prev = useDriftPlaybackStore.getState().driftPlayhead;
                let nextVal = prev;
                if (isForecastMode) {
                    if (prev >= 48) nextVal = 0;
                    else nextVal = prev + 12;
                } else {
                    if (prev >= 0) nextVal = -72;
                    else nextVal = prev + 24;
                }
                setDriftPlayhead(nextVal);
            }, dynamicInterval);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, isForecastMode, setDriftPlayhead, speed]);

    // Timeline ticks computation
    const ticks = isForecastMode
        ? [0, 12, 24, 36, 48]
        : [-72, -48, -24, 0];

    const progressPct = maxVal === minVal ? 0 : ((driftPlayhead - minVal) / (maxVal - minVal)) * 100;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#08121e]/90 border border-white/15 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl w-[540px] z-20 flex flex-col space-y-3 font-mono select-none">
            {/* Playback Controls & Mode Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlaying}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isPlaying
                            ? 'bg-[var(--sonar-amber)] text-[var(--abyss)] shadow-[0_0_12px_rgba(245,158,11,0.5)] font-bold'
                            : 'bg-[var(--slick-teal)] text-[var(--abyss)] shadow-[0_0_12px_rgba(0,242,254,0.4)] font-bold'
                            }`}
                        title={isPlaying ? 'Pause simulation' : 'Play simulation'}
                    >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>

                    {/* Step Back */}
                    <button
                        onClick={handleStepBack}
                        disabled={driftPlayhead <= minVal}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors border border-white/5"
                        title="Step backward"
                    >
                        <SkipBack size={12} />
                    </button>

                    {/* Step Forward */}
                    <button
                        onClick={handleStepForward}
                        disabled={driftPlayhead >= maxVal}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors border border-white/5"
                        title="Step forward"
                    >
                        <SkipForward size={12} />
                    </button>

                    {/* Reset */}
                    <button
                        onClick={() => setDriftPlayhead(minVal)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors border border-white/5"
                        title="Reset simulation time"
                    >
                        <RotateCcw size={12} />
                    </button>

                    {/* Speed Selector */}
                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 ml-1">
                        {[0.5, 1, 2, 5].map((s) => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={`px-1.5 py-0.5 text-[8.5px] rounded transition-all ${speed === s
                                    ? 'bg-[var(--slick-teal)] text-[var(--abyss)] font-bold'
                                    : 'text-white/40 hover:text-white'
                                    }`}
                            >
                                {s}×
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Drift Status readout & Hindcast / Forecast switch */}
                <div className="flex items-center space-x-2.5">
                    <span className="text-[11px] text-[var(--slick-teal)] font-bold">
                        {driftPlayhead === 0 ? 'T₀ DETECTION (0h)' : `${driftPlayhead > 0 ? `+${driftPlayhead}` : driftPlayhead}h`}
                    </span>

                    <div className="flex items-center space-x-1 p-0.5 bg-black/40 rounded-lg border border-white/10">
                        <button
                            onClick={() => setForecastMode(false)}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${!isForecastMode
                                ? 'bg-[var(--slick-teal)] text-[var(--abyss)] shadow-[0_0_8px_rgba(0,242,254,0.4)]'
                                : 'text-white/40 hover:text-white'
                                }`}
                        >
                            HINDCAST
                        </button>
                        <button
                            onClick={() => setForecastMode(true)}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${isForecastMode
                                ? 'bg-[var(--sonar-amber)] text-[var(--abyss)] shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                : 'text-white/40 hover:text-white'
                                }`}
                        >
                            FORECAST
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Interactive Timeline Scrub Track */}
            <div className="space-y-1.5 pt-1">
                <div className="relative flex items-center">
                    {/* Background styled gradient track */}
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${isForecastMode
                                ? 'bg-gradient-to-r from-[var(--sonar-amber)] to-[#ff4d4d]'
                                : 'bg-gradient-to-r from-[#B877FF] via-[#00f2fe] to-[var(--slick-teal)]'
                                }`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>

                    {/* Native slider on top of track */}
                    <input
                        type="range"
                        min={minVal}
                        max={maxVal}
                        step={step}
                        value={driftPlayhead}
                        onChange={(e) => setDriftPlayhead(parseInt(e.target.value, 10))}
                        className="relative z-10 w-full h-4 opacity-0 cursor-pointer"
                    />

                    {/* Draggable indicator thumb visible position */}
                    <div
                        className="absolute z-20 w-3.5 h-3.5 rounded-full bg-white border-2 border-[var(--slick-teal)] shadow-[0_0_10px_#00f2fe] pointer-events-none -translate-x-1/2"
                        style={{ left: `${progressPct}%` }}
                    />
                </div>

                {/* Timeline tick labels */}
                <div className="flex justify-between text-[8px] text-white/30 px-0.5">
                    {ticks.map((t) => (
                        <span
                            key={t}
                            onClick={() => setDriftPlayhead(t)}
                            className={`cursor-pointer hover:text-white transition-colors ${driftPlayhead === t ? 'text-[var(--slick-teal)] font-bold' : ''}`}
                        >
                            {t === 0 ? 'T₀' : `${t > 0 ? `+${t}` : t}h`}
                        </span>
                    ))}
                </div>
            </div>

            {/* Dynamic Lagrangian status readout */}
            <div className="bg-black/40 px-3 py-1.5 border border-white/10 rounded-lg text-[9px] flex items-center justify-between">
                <span className="text-white/40 flex items-center space-x-1">
                    <Activity size={10} className="text-[var(--slick-teal)]" />
                    <span>PARTICLE DISPERSION:</span>
                </span>
                <span className={isForecastMode ? "text-[var(--sonar-amber)] font-semibold" : "text-[var(--slick-teal)] font-semibold"}>
                    {driftPlayhead === 0
                        ? 'EPICENTRAL ACCUMULATION (0h)'
                        : isForecastMode
                            ? `FORWARD SPREAD EXPANSION: +${((driftPlayhead / 48) * 100).toFixed(0)}%`
                            : `REVERSE LAGRANGIAN CONVERGENCE: ${((Math.abs(driftPlayhead) / 72) * 100).toFixed(0)}% TO ORIGIN`}
                </span>
            </div>

            {/* Sensor info footer */}
            <div className="flex items-center justify-between text-[8.5px] text-white/30 border-t border-white/5 pt-2 pb-0.5">
                <span className="flex items-center">
                    <Navigation size={9} className="mr-1 text-[var(--slick-teal)]" />
                    Lagrangian Particle Tracking Engine ({isForecastMode ? 'Forward Forecast' : 'Reverse Hindcast'})
                </span>
                <span>STEP: {Math.abs(step)}H · SPEED: {speed}×</span>
            </div>
        </div>
    );
};
