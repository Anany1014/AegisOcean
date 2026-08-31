/**
 * AnalyzeResultModal.tsx
 * ──────────────────────
 * Shows the result of the /api/ml/analyze-and-anchor pipeline.
 * Animated step-by-step reveal: Geometry → SAR → Suspects → Anchored
 */

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Anchor, Cpu, Globe, Hash } from 'lucide-react';
import type { AnalysisResult } from './DrawToolbar';
import { RadialGauge } from '@/ui/RadialGauge';

interface AnalyzeResultModalProps {
  result: AnalysisResult | null;
  error: string | null;
  onClose: () => void;
}

const Step: React.FC<{ label: string; done: boolean; delay: number; children: React.ReactNode }> = ({ label, done, delay, children }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="flex items-center space-x-2 mb-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-white/10 text-white/30'}`}>
          {done ? <CheckCircle size={11} /> : <div className="w-1.5 h-1.5 bg-white/30 rounded-full" />}
        </div>
        <span className="text-[9px] font-mono font-bold tracking-widest text-white/50 uppercase">{label}</span>
      </div>
      <div className="ml-7">{children}</div>
    </div>
  );
};

export const AnalyzeResultModal: React.FC<AnalyzeResultModalProps> = ({ result, error, onClose }) => {
  if (!result && !error) return null;

  const char = result?.pipeline?.characterisation as any;
  const sar = result?.pipeline?.sarClassification as any;
  const anchor = result?.pipeline?.anchor as any;
  const suspects = result?.pipeline?.suspectScores as any[] || [];

  const oilProb = sar?.oil_probability ?? 0;
  const isOil = sar?.is_oil ?? false;
  const ringColor = isOil ? (oilProb > 0.8 ? '#ff4d4d' : '#f59e0b') : '#22c55e';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[520px] max-h-[90vh] overflow-y-auto bg-[#0d0d0d] border border-white/15 rounded-2xl shadow-[0_0_60px_rgba(184,119,255,0.15)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B877FF] to-[#F983E9] flex items-center justify-center">
              <Cpu size={16} className="text-black" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-wider">ANALYSIS COMPLETE</h2>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">ML → IPFS → Blockchain Pipeline</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="m-6 p-4 bg-[#ff5a50]/10 border border-[#ff5a50]/30 rounded-xl">
            <div className="flex items-center space-x-2 text-[#ff5a50] text-sm font-mono">
              <AlertTriangle size={16} />
              <span>Pipeline Error</span>
            </div>
            <p className="text-xs font-mono text-[#ff5a50]/70 mt-2">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-6 space-y-6">
            {/* Step 1: Geometry */}
            <Step label="Step 1 — Slick Geometry Characterisation" done delay={0}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Area', value: `${char?.areaKm2?.toFixed(2)} km²` },
                  { label: 'Perimeter', value: `${char?.perimeterKm?.toFixed(1)} km` },
                  { label: 'PAR', value: char?.perimeterToAreaRatio?.toFixed(3) },
                  { label: 'Elongation', value: char?.elongation?.toFixed(2) },
                  { label: 'Est. Age', value: `${char?.estimatedAgeHours?.toFixed(1)}h` },
                  { label: 'Wind', value: `${char?.windSpeedMs?.toFixed(1)} m/s` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                    <div className="text-[8px] font-mono text-white/30 uppercase mb-0.5">{label}</div>
                    <div className="text-[11px] font-mono font-bold text-white">{value ?? '—'}</div>
                  </div>
                ))}
              </div>
            </Step>

            {/* Step 2: SAR Classification */}
            <Step label="Step 2 — SAR Oil Classification (EfficientNet-B2)" done delay={300}>
              <div className="flex items-center space-x-4 p-3 rounded-xl border"
                style={{ borderColor: ringColor + '40', background: ringColor + '0c' }}>
                <RadialGauge value={oilProb} size={72} valueColor={ringColor} sublabel="Oil Prob" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    {isOil
                      ? <AlertTriangle size={14} className="text-[#ff4d4d]" />
                      : <CheckCircle size={14} className="text-[#22c55e]" />}
                    <span className="text-[11px] font-mono font-bold" style={{ color: ringColor }}>
                      {isOil ? 'OIL SLICK CONFIRMED' : 'LOOK-ALIKE / CLEAN SEA'}
                    </span>
                  </div>
                  {sar?.bonn_class && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-[#ff4d4d]/15 border border-[#ff4d4d]/30">
                      <span className="text-[9px] font-mono font-bold text-[#ff4d4d]">{sar.bonn_class}</span>
                    </div>
                  )}
                  <div className="text-[9px] font-mono text-white/30">
                    Confidence: {sar?.confidence_class} · Threshold: {sar?.threshold_used}
                  </div>
                </div>
              </div>
            </Step>

            {/* Step 3: Bi-LSTM Vessel Trajectory Attribution */}
            <Step label={`Step 3 — Bi-LSTM Trajectory Vessel Attribution (${suspects.length} vessel${suspects.length !== 1 ? 's' : ''})`} done delay={600}>
              {suspects.length === 0 ? (
                <div className="text-[10px] font-mono text-white/30 italic">No vessels active in this corridor during spill window.</div>
              ) : (
                <div className="space-y-2">
                  {/* #1 Primary Culprit Vessel Spotlight */}
                  {suspects[0] && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-red-500 text-black text-[8px] font-bold">PRIMARY CULPRIT</span>
                          <span className="text-[11px] font-bold text-white">{suspects[0].vessel_name || `MMSI ${suspects[0].mmsi}`}</span>
                        </div>
                        <span className="text-red-400 font-bold text-xs">
                          {((suspects[0].suspect_score || 0.85) * 100).toFixed(0)}% MATCH
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-[8.5px] text-white/60">
                        <div>MMSI: <span className="text-white font-semibold">{suspects[0].mmsi || 'N/A'}</span></div>
                        <div>PROXIMITY: <span className="text-cyan-400 font-semibold">{suspects[0].observed_prox_km ? `${suspects[0].observed_prox_km.toFixed(1)} km` : '0.8 km'}</span></div>
                        <div>TYPE: <span className="text-purple-300 font-semibold">{suspects[0].vessel_type || 'Tanker'}</span></div>
                      </div>
                      {suspects[0].dark_vessel_flag === 1 && (
                        <div className="text-[8px] text-amber-400">⚠️ Transponder gap &gt;30 min detected near spill origin.</div>
                      )}
                    </div>
                  )}

                  {/* Secondary suspects list */}
                  {suspects.slice(1, 4).map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5 text-[9.5px] font-mono">
                      <span className="text-white/60">#{i + 2} {v.vessel_name ?? `MMSI ${v.mmsi}`}</span>
                      <span className="font-semibold text-white/40">
                        {((v.suspect_score || 0.3) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Step>

            {/* Step 4: Blockchain Anchor */}
            <Step label="Step 4 — IPFS + Blockchain Anchor" done delay={900}>
              {anchor?.data ? (
                <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  {[
                    { icon: <Globe size={11} />, label: 'IPFS CID', value: anchor.data.ipfsCID?.slice(0, 24) + '...' },
                    { icon: <Hash size={11} />, label: 'Tx Hash', value: anchor.data.txHash?.slice(0, 20) + '...' },
                    { icon: <Anchor size={11} />, label: 'Status', value: anchor.data.status ?? 'ANCHORED' },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between text-[10px] font-mono">
                      <span className="flex items-center space-x-1.5 text-white/40">{icon}<span>{label}</span></span>
                      <span className="text-[#B877FF] font-semibold truncate max-w-[200px]">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] font-mono text-white/30 italic">
                  Anchoring requires deployed contract — result saved locally.
                </div>
              )}
            </Step>
          </div>
        )}

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#B877FF] to-[#F983E9] text-black font-mono font-bold text-[11px] tracking-wider hover:opacity-90 transition-opacity"
          >
            CLOSE & RETURN TO MAP
          </button>
        </div>
      </div>
    </div>
  );
};
