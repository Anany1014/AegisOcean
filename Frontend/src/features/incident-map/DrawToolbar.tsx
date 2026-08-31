/**
 * DrawToolbar.tsx
 * ───────────────
 * Floating polygon draw toolbar for the map.
 * States: IDLE → DRAWING (collecting clicks) → READY (polygon complete)
 * When ready, triggers /api/ml/analyze-and-anchor via apiClient.
 */

import React, { useState, useCallback } from 'react';
import { Pencil, X, Zap, CheckSquare, Trash2, Loader2, Wind } from 'lucide-react';
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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[480px]">
      <div className="bg-[#111]/92 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${drawState === 'drawing' ? 'bg-[#F983E9] animate-pulse' : 'bg-[#B877FF]'}`} />
            <span className="text-[10px] font-mono font-bold tracking-widest text-white/80 uppercase">
              {drawState === 'drawing'
                ? `DRAWING — ${polygon.length} POINT${polygon.length !== 1 ? 'S' : ''} (click to add · double-click to close)`
                : drawState === 'loading'
                ? 'RUNNING ML PIPELINE...'
                : 'POLYGON READY'}
            </span>
          </div>
          <button onClick={onCancelDraw} className="text-white/30 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex items-center space-x-3">
          {/* Wind speed slider */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-white/40">
              <span className="flex items-center space-x-1">
                <Wind size={9} />
                <span>WIND SPEED</span>
              </span>
              <span className="text-[#B877FF] font-semibold">{windSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range" min={0.5} max={15} step={0.5} value={windSpeed}
              onChange={e => setWindSpeed(parseFloat(e.target.value))}
              className="w-full h-1 accent-[#B877FF] bg-white/10 rounded-full outline-none cursor-pointer"
            />
            <div className="flex justify-between text-[8px] font-mono text-white/20">
              <span>CALM</span>
              <span>STORM</span>
            </div>
          </div>

          {/* Vertex count */}
          {drawState !== 'drawing' && (
            <div className="text-center px-3">
              <div className="text-[20px] font-bold font-mono text-[#B877FF]">{polygon.length}</div>
              <div className="text-[8px] font-mono text-white/30 uppercase">Vertices</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {drawState === 'ready' && (
              <>
                <button
                  onClick={onClearPolygon}
                  className="p-2 rounded-lg border border-white/10 text-white/30 hover:text-[#ff5a50] hover:border-[#ff5a50]/40 transition-all"
                  title="Clear polygon"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => onAnalyze(windSpeed)}
                  disabled={loading || polygon.length < 3}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-[#B877FF] to-[#F983E9] text-black font-mono font-bold text-[10px] rounded-lg hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(184,119,255,0.4)]"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  <span>ANALYZE</span>
                </button>
              </>
            )}
            {drawState === 'drawing' && polygon.length >= 3 && (
              <button
                onClick={() => onAnalyze(windSpeed)}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3 py-2 border border-[#B877FF]/50 text-[#B877FF] font-mono text-[9px] rounded-lg hover:bg-[#B877FF]/10 transition-all"
              >
                <CheckSquare size={12} />
                <span>CLOSE & ANALYZE</span>
              </button>
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
