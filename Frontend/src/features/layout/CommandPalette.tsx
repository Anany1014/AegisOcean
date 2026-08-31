/**
 * CommandPalette.tsx
 * ──────────────────
 * Cmd+K searchable command palette.
 * Searches incidents by ID, ports by name, and top-level actions.
 * Closes on Escape or outside click.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, Zap, Ship, AlertCircle, X, CornerDownLeft } from 'lucide-react';
import { useUiStore } from '@/stores/useUiStore';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const PORTS = [
  { name: 'Mumbai Port Authority', coords: [72.85, 18.95] },
  { name: 'Kochi Port Authority', coords: [76.27, 9.97] },
  { name: 'Chennai Port Authority', coords: [80.30, 13.09] },
  { name: 'Visakhapatnam Port', coords: [83.30, 17.68] },
  { name: 'New Mangalore Port', coords: [74.82, 12.87] },
  { name: 'Kolkata Port', coords: [88.32, 22.50] },
  { name: 'JNPT', coords: [72.94, 18.94] },
];

const ACTIONS = [
  { id: 'live', label: 'Switch to LIVE data stream', icon: <Zap size={13} className="text-[#22c55e]" />, type: 'action' as const },
  { id: 'mock', label: 'Switch to MOCK simulation', icon: <Zap size={13} className="text-[#f59e0b]" />, type: 'action' as const },
  { id: 'vessel', label: 'Open Vessel Dashboard', icon: <Ship size={13} className="text-[#B877FF]" />, type: 'action' as const },
];

type ResultItem =
  | { type: 'incident'; id: string; severity: string; areaKm2: number }
  | { type: 'port'; name: string; coords: number[] }
  | { type: 'action'; id: string; label: string; icon: React.ReactNode };

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setSelectedIncidentId, setMockMode, isMockMode } = useUiStore();

  const { data: incidents } = useQuery({
    queryKey: ['incidents', isMockMode],
    queryFn: () => apiClient.getIncidents(isMockMode),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo<ResultItem[]>(() => {
    const q = query.toLowerCase().trim();
    const items: ResultItem[] = [];

    // Incidents
    incidents?.filter(inc =>
      !q || inc.id.toLowerCase().includes(q) || (inc.severity && inc.severity.toLowerCase().includes(q))
    ).slice(0, 5).forEach(inc =>
      items.push({ type: 'incident', id: inc.id, severity: inc.severity || 'HIGH', areaKm2: inc.areaKm2 })
    );

    // Ports
    PORTS.filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, 3).forEach(p =>
      items.push({ type: 'port', name: p.name, coords: p.coords })
    );

    // Actions
    ACTIONS.filter(a => !q || a.label.toLowerCase().includes(q)).forEach(a =>
      items.push({ type: 'action', id: a.id, label: a.label, icon: a.icon })
    );

    return items;
  }, [query, incidents]);

  useEffect(() => { setSelectedIdx(0); }, [results]);

  const activate = (item: ResultItem) => {
    if (item.type === 'incident') {
      setSelectedIncidentId(item.id);
      onClose();
    } else if (item.type === 'port') {
      // future: fly to port
      onClose();
    } else if (item.type === 'action') {
      if (item.id === 'live') setMockMode(false);
      else if (item.id === 'mock') setMockMode(true);
      else if (item.id === 'vessel') navigate('/vessel-dashboard');
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { setSelectedIdx(i => Math.min(i + 1, results.length - 1)); e.preventDefault(); }
      if (e.key === 'ArrowUp') { setSelectedIdx(i => Math.max(i - 1, 0)); e.preventDefault(); }
      if (e.key === 'Enter' && results[selectedIdx]) { activate(results[selectedIdx]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selectedIdx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[560px] bg-[#0c0c0c]/97 border border-white/15 rounded-2xl shadow-[0_0_80px_rgba(184,119,255,0.2)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-white/10 space-x-3">
          <Search size={16} className="text-white/30 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search incidents, ports, actions..."
            className="flex-1 bg-transparent text-white font-mono text-[13px] outline-none placeholder:text-white/20"
          />
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-[11px] font-mono text-white/20">No results for "{query}"</div>
          )}
          {results.map((item, idx) => (
            <button
              key={idx}
              onClick={() => activate(item)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 text-left transition-colors ${idx === selectedIdx ? 'bg-[#B877FF]/10 text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              {/* Icon */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${idx === selectedIdx ? 'bg-[#B877FF]/20' : 'bg-white/5'}`}>
                {item.type === 'incident' && <AlertCircle size={13} className={item.severity === 'HIGH' ? 'text-[#ff5a50]' : item.severity === 'MEDIUM' ? 'text-[#f59e0b]' : 'text-[#22c55e]'} />}
                {item.type === 'port' && <MapPin size={13} className="text-[#C6F1F7]" />}
                {item.type === 'action' && (item as any).icon}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                {item.type === 'incident' && (
                  <>
                    <div className="text-[11px] font-mono font-semibold truncate">{item.id}</div>
                    <div className="text-[9px] font-mono text-white/30">{item.severity} · {item.areaKm2.toFixed(1)} km²</div>
                  </>
                )}
                {item.type === 'port' && (
                  <div className="text-[11px] font-mono font-semibold">{item.name}</div>
                )}
                {item.type === 'action' && (
                  <div className="text-[11px] font-mono font-semibold">{item.label}</div>
                )}
              </div>

              {/* Enter hint */}
              {idx === selectedIdx && <CornerDownLeft size={12} className="text-white/20 flex-shrink-0" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[9px] font-mono text-white/20">
          <span>↑↓ navigate · ↵ select · ESC close</span>
          <span>⌘K</span>
        </div>
      </div>
    </div>
  );
};
