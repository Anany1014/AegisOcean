import { create } from 'zustand';

interface DriftPlaybackState {
    driftPlayhead: number; // Offset in hours: -72 to 48
    isPlaying: boolean;
    isForecastMode: boolean; // Hindcast (-72 to 0) vs Forecast (0 to 48)
    setDriftPlayhead: (hours: number) => void;
    setIsPlaying: (playing: boolean) => void;
    setForecastMode: (forecast: boolean) => void;
    togglePlaying: () => void;
}

export const useDriftPlaybackStore = create<DriftPlaybackState>((set) => ({
    driftPlayhead: 0,
    isPlaying: false,
    isForecastMode: false,
    setDriftPlayhead: (driftPlayhead) => set({ driftPlayhead }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setForecastMode: (isForecastMode) =>
        set(() => ({
            isForecastMode,
            driftPlayhead: isForecastMode ? 0 : -72, // auto-reset playhead basis mode
        })),
    togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));
