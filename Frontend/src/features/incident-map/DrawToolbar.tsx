/**
 * DrawToolbar.tsx
 * ───────────────
 * Floating polygon draw toolbar for the map.
 * States: IDLE → DRAWING (collecting clicks) → READY (polygon complete)
 * When ready, triggers /api/ml/analyze-and-anchor via apiClient.
 */

import React, { useState, useCallback } from 'react';
import { Pencil, X, Zap, Trash2, Loader2, Wind } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export type DrawState = 'idle' | 'drawing' | 'ready' | 'loading' | 'done';

export interface AnalysisResult {
  pipeline: {
    characterisation: Record<string, unknown>;
    sarClassification: Record<string, unknown>;
    suspectScores: unknown[];
    anchor: Record<string, unknown>;
  };
}

interface DrawToolbarProps {
  drawState: DrawState;
  polygon: number[][];
  onStartDraw: () => void;
  onCancelDraw: () => void;
  onClearPolygon: () => void;
  onAnalyze: (windSpeedMs: number) => void;
  loading: boolean;
}

export const DrawToolbar: React.FC<DrawToolbarProps> = ({
  drawState,
  polygon,
  onStartDraw,
  onCancelDraw,
  onClearPolygon,
  onAnalyze,
  loading,
}) => {
  const [windSpeed, setWindSpeed] = useState(4.5);

  if (drawState === 'idle') {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={onStartDraw}
          className="flex items-center space-x-2 px-4 py-2 bg-[#1c1c1c]/90 border border-white/20 rounded-full text-[11px] font-mono font-semibold text-white/80 hover:text-white hover:border-[#B877FF]/60 hover:bg-[#B877FF]/10 backdrop-blur-md transition-all shadow-xl group"
        >
          <Pencil size={13} className="text-[#B877FF] group-hover:rotate-[-15deg] transition-transform" />
          <span>DRAW SPILL AREA</span>
          <span className="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[8px] tracking-widest">⌃D</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[520px]">
      <div className="bg-[#111]/95 border border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${drawState === 'drawing' ? 'bg-[#F983E9] animate-ping' : 'bg-[#B877FF]'}`} />
            <span className="text-[10px] font-mono font-bold tracking-widest text-white/90 uppercase">
              {drawState === 'drawing'
                ? `DRAWING — ${polygon.length} VERTICES (CLICK MAP TO PLACE POINTS)`
                : drawState === 'loading'
                ? '⚡ EXECUTING STAGE 2 SAR & BI-LSTM ATTRIBUTION...'
                : 'POLYGON SEALED & READY'}
            </span>
          </div>
          <button onClick={onCancelDraw} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex items-center space-x-3">
          {/* Wind speed slider */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-white/50">
              <span className="flex items-center space-x-1">
                <Wind size={10} className="text-cyan-400" />
                <span>ERA5 WIND SPEED</span>
              </span>
              <span className="text-[#B877FF] font-semibold">{windSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range" min={0.5} max={15} step={0.5} value={windSpeed}
              onChange={e => setWindSpeed(parseFloat(e.target.value))}
              className="w-full h-1 accent-[#B877FF] bg-white/10 rounded-full outline-none cursor-pointer"
            />
            <div className="flex justify-between text-[7.5px] font-mono text-white/30">
              <span>CALM (&lt;2m/s)</span>
              <span>OPTIMAL (3-6m/s)</span>
              <span>HIGH WIND (&gt;10m/s)</span>
            </div>
          </div>

          {/* Vertex count */}
          <div className="text-center px-2 border-l border-white/10">
            <div className="text-[18px] font-bold font-mono text-[#B877FF]">{polygon.length}</div>
            <div className="text-[7.5px] font-mono text-white/40 uppercase">Points</div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {polygon.length > 0 && (
              <button
                onClick={onClearPolygon}
                className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-[#ff5a50] hover:border-[#ff5a50]/40 transition-all"
                title="Reset points"
              >
                <Trash2 size={13} />
              </button>
            )}

            {polygon.length >= 3 ? (
              <button
                onClick={() => onAnalyze(windSpeed)}
                disabled={loading}
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-[#B877FF] to-[#F983E9] text-black font-mono font-bold text-[10px] rounded-lg hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(184,119,255,0.5)] cursor-pointer"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>PREDICT & ANCHOR</span>
              </button>
            ) : (
              <span className="text-[9px] font-mono text-white/40 italic px-2">
                Click {Math.max(0, 3 - polygon.length)} more point{3 - polygon.length !== 1 ? 's' : ''} on map
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Hook: analyze-and-anchor ─────────────────────────────────────────────────

export function useAnalyzeAnchor() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (polygon: number[][], windSpeedMs: number, mmsi = 999999999) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.analyzeAndAnchorIncident({
        suspectMMSI: mmsi,
        polygon,
        windSpeedMs,
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, result, error, analyze, setResult };
}
