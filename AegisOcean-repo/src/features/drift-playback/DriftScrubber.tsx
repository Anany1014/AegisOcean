import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Navigation } from 'lucide-react';
import { useDriftPlaybackStore } from '@/stores/useDriftPlaybackStore';
import { Button } from '@/ui/Button';

export const DriftScrubber: React.FC = () => {
    const {
        driftPlayhead,
        isPlaying,
        isForecastMode,
        setDriftPlayhead,
        setForecastMode,
        togglePlaying,
    } = useDriftPlaybackStore();

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Playback timer loop
    useEffect(() => {
        if (isPlaying) {
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
            }, 1500);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, isForecastMode, setDriftPlayhead]);

    const minVal = isForecastMode ? 0 : -72;
    const maxVal = isForecastMode ? 48 : 0;
    const step = isForecastMode ? 12 : 24;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--panel)] border border-[var(--hairline)] rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-panel)] w-[480px] z-20 flex flex-col space-y-3">
            {/* Playback Controls & Mode Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button
                        size="sm"
                        onClick={togglePlaying}
                        className="w-8 h-8 !p-0"
                        title={isPlaying ? 'Pause simulation' : 'Play simulation'}
                    >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </Button>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDriftPlayhead(minVal)}
                        className="w-8 h-8 !p-0"
                        title="Reset simulation time"
                    >
                        <RotateCcw size={14} />
                    </Button>

                    <span className="text-[11px] font-mono tracking-wider text-[var(--foam-dim)] uppercase pl-2">
                        Drift Time:
                    </span>
                    <span className="data-value text-[var(--slick-teal)] font-bold text-xs">
                        {driftPlayhead === 0 ? 'DETECTION POINT (0h)' : `${driftPlayhead}h`}
                    </span>
                </div>

                {/* Hindcast / Forecast selector (F9) */}
                <div className="flex items-center space-x-1 p-0.5 bg-[var(--abyss)] rounded-[4px] border border-[var(--hairline)]">
                    <button
                        onClick={() => setForecastMode(false)}
                        className={`px-2 py-0.5 text-[9px] font-mono rounded-[2px] transition-colors ${!isForecastMode
                            ? 'bg-[var(--slick-teal)] text-[var(--foam)] font-semibold'
                            : 'text-[var(--foam-dim)] hover:text-[var(--foam)]'
                            }`}
                    >
                        HINDCAST
                    </button>
                    <button
                        onClick={() => setForecastMode(true)}
                        className={`px-2 py-0.5 text-[9px] font-mono rounded-[2px] transition-colors ${isForecastMode
                            ? 'bg-[var(--sonar-amber)] text-[var(--abyss)] font-bold'
                            : 'text-[var(--foam-dim)] hover:text-[var(--foam)]'
                            }`}
                    >
                        FORECAST
                    </button>
                </div>
            </div>

            {/* Slider scrub track */}
            <div className="flex items-center space-x-3">
                <span className="text-[10px] font-mono text-[var(--foam-dim)] w-8 text-right">
                    {minVal}h
                </span>
                <input
                    type="range"
                    min={minVal}
                    max={maxVal}
                    step={step}
                    value={driftPlayhead}
                    onChange={(e) => setDriftPlayhead(parseInt(e.target.value))}
                    className="flex-1 accent-[var(--slick-teal)] h-1 bg-[var(--abyss)] rounded-lg outline-none cursor-pointer"
                />
                <span className="text-[10px] font-mono text-[var(--foam-dim)] w-8">
                    +{maxVal}h
                </span>
            </div>

            {/* Dynamic Lagrangian status readout (F9 Hindcast convergence) */}
            <div className="bg-[var(--abyss)] px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-chip)] text-[9px] font-mono flex items-center justify-between">
                <span className="text-[var(--foam-dim)]">PARTICLE CLOUD:</span>
                <span className={isForecastMode ? "text-[var(--sonar-amber)] font-semibold" : "text-[var(--slick-teal)] font-semibold"}>
                    {driftPlayhead === 0
                        ? 'EPICENTRAL ACCUMULATION (0h)'
                        : isForecastMode
                            ? `FORWARD DISPERSION EXPANSION: +${((driftPlayhead / 48) * 100).toFixed(0)}%`
                            : `REVERSE LAGRANGIAN CONVERGENCE RATE: ${((Math.abs(driftPlayhead) / 72) * 100).toFixed(0)}% TO ORIGIN`}
                </span>
            </div>

            {/* Sensor information readout */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--foam-dim)] opacity-75 border-t border-[var(--hairline)] pt-2 pb-0.5">
                <span className="flex items-center">
                    <Navigation size={10} className="mr-1 text-[var(--slick-teal)]" />
                    Lagrangian Particle Tracking Engine ({isForecastMode ? 'Forward' : 'Reverse hindcast'})
                </span>
                <span>STEP RES: {Math.abs(step)}H</span>
            </div>
        </div>
    );
};
