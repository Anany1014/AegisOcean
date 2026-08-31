import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/useUiStore';
import { CommandPalette } from './CommandPalette';
import { Search } from 'lucide-react';

import { TriageSidebar } from '../triage-sidebar/TriageSidebar';
import { MapConsole } from '../incident-map/MapConsole';
import { DriftScrubber } from '../drift-playback/DriftScrubber';
import { DetectionDrawer } from '../detection-detail/DetectionDrawer';

// Figma Star SVG Icon component
const FigmaStar: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 34 33" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M16.7417 0L18.9626 10.8982L27.6691 3.97724L22.3652 13.7533L33.4834 14.048L23.1365 18.1276L31.4641 25.5L20.9156 21.9743L22.556 32.9748L16.7417 23.4934L10.9274 32.9748L12.5678 21.9743L2.01927 25.5L10.3469 18.1276L-3.24249e-05 14.048L11.1182 13.7533L5.81431 3.97724L14.5208 10.8982L16.7417 0Z" fill="url(#star-grad)" />
        <defs>
            <linearGradient id="star-grad" x1="-1.59163" y1="-2.76742" x2="36.5955" y2="-1.98964" gradientUnits="userSpaceOnUse">
                <stop stopColor="#C6F1F7" />
                <stop offset="0.364583" stopColor="#F983E9" />
                <stop offset="0.739583" stopColor="#B877FF" />
                <stop offset="1" stopColor="#C2E9CD" />
            </linearGradient>
        </defs>
    </svg>
);

export const WorkspaceDashboard: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const { isMockMode, setMockMode, selectedIncidentId, setSelectedIncidentId } = useUiStore();
    const [paletteOpen, setPaletteOpen] = useState(false);

    // Sync route param with Zustand UI state
    useEffect(() => {
        if (id) {
            setSelectedIncidentId(id);
        } else {
            setSelectedIncidentId(null);
        }
    }, [id, setSelectedIncidentId]);

    // Keyboard shortcut Cmd+K or Ctrl+K for Command Palette
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setPaletteOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="h-screen w-screen flex flex-col bg-[var(--abyss)] overflow-hidden select-none">
            {/* ── Top Live Telemetry Ticker Strip (HUD Style) ── */}
            <div className="h-6 bg-[#040810] border-b border-white/5 px-4 flex items-center justify-between text-[8.5px] font-mono tracking-widest text-white/50 z-50 overflow-hidden">
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-1.5 text-[var(--slick-teal)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--slick-teal)] animate-pulse" />
                        <span className="font-bold">LIVE TELEMETRY</span>
                    </div>
                    <div className="hidden sm:flex items-center space-x-4 text-white/40">
                        <span>SENTINEL-1A · <span className="text-[#22c55e]">PASS ACTIVE</span></span>
                        <span>ERA5 ATMOSPHERIC · <span className="text-[var(--slick-teal)]">4.8 m/s NE</span></span>
                        <span>COPERNICUS CMEMS · <span className="text-[#a855f7]">CURRENT 0.8 kn</span></span>
                        <span>SMART CONTRACT · <span className="text-[#00f2fe]">HARDHAT #31337</span></span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-white/30 hidden md:inline">ENCRYPTION: AES-256-GCM</span>
                    <span className="text-[var(--sonar-amber)] font-semibold">EEZ PATROL ACTIVE</span>
                </div>
            </div>

            {/* ── Top Command Bar (Glassmorphism HUD Style) ── */}
            <header className="h-16 border-b border-white/10 bg-[#08121e]/85 backdrop-blur-xl px-6 flex items-center justify-between z-40 relative shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                {/* Brand & Status */}
                <div className="flex items-center space-x-4">
                    {/* Corner-bracket HUD wrapper */}
                    <div className="relative p-1.5 border border-white/10 rounded-lg bg-white/5 shadow-[0_0_15px_rgba(0,242,254,0.15)] flex items-center justify-center">
                        <span className="absolute -top-1 -left-1 text-[8px] text-[var(--slick-teal)] font-mono leading-none">┌</span>
                        <span className="absolute -top-1 -right-1 text-[8px] text-[var(--slick-teal)] font-mono leading-none">┐</span>
                        <span className="absolute -bottom-1 -left-1 text-[8px] text-[var(--slick-teal)] font-mono leading-none">└</span>
                        <span className="absolute -bottom-1 -right-1 text-[8px] text-[var(--slick-teal)] font-mono leading-none">┘</span>
                        <FigmaStar className="animate-[spin_12s_linear_infinite]" size={22} />
                    </div>
                    <div>
                        <h1 className="font-display font-black text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF] flex items-center">
                            AEGISOCEAN <span className="text-white/30 mx-2 font-normal">//</span> <span className="text-white font-medium text-[10px] tracking-widest">DEFENSE OPS</span>
                        </h1>
                        <p className="text-[8px] font-mono text-white/40 tracking-widest uppercase flex items-center space-x-1.5 mt-0.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                            <span>PASSIVE SAR + BI-LSTM MARITIME SURVEILLANCE · v2.0.4</span>
                        </p>
                    </div>
                </div>

                {/* Center Command / Search & Navigation Tabs */}
                <div className="hidden lg:flex items-center space-x-4">
                    <button
                        onClick={() => setPaletteOpen(true)}
                        className="flex items-center space-x-2 px-3.5 py-1.5 bg-black/40 hover:bg-black/60 border border-white/15 hover:border-[var(--slick-teal)]/50 rounded-[var(--radius-card)] text-[10px] font-mono text-white/60 hover:text-white transition-all shadow-inner group"
                    >
                        <Search size={12} className="text-[var(--slick-teal)] group-hover:scale-110 transition-transform" />
                        <span>QUICK COMMAND / SEARCH...</span>
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[8px] tracking-widest text-white/40">⌘K</span>
                    </button>

                    <div className="flex items-center space-x-1.5 text-[10px] font-mono bg-black/30 p-1 rounded-lg border border-white/10">
                        <button className="px-3 py-1 text-white font-bold rounded-[var(--radius-chip)] bg-[var(--slick-teal)]/20 border border-[var(--slick-teal)]/40 tracking-wider">
                            INCIDENTS
                        </button>
                        <button
                            onClick={() => navigate('/vessel-dashboard')}
                            className="px-3 py-1 text-white/50 hover:text-white rounded-[var(--radius-chip)] tracking-wider hover:bg-white/5 transition-colors"
                        >
                            VESSELS
                        </button>
                    </div>
                </div>

                {/* Selected Incident Telemetry Tag */}
                {selectedIncidentId && (
                    <div className="hidden xl:flex items-center space-x-5 text-xs font-mono border-l border-white/10 pl-5">
                        <div>
                            <span className="opacity-40 mr-1.5 text-[9px] uppercase tracking-wider">TARGET:</span>
                            <span className="text-[var(--slick-teal)] font-bold tracking-wider">{selectedIncidentId}</span>
                        </div>
                        <div>
                            <span className="opacity-40 mr-1.5 text-[9px] uppercase tracking-wider">ML MODEL:</span>
                            <span className="text-[var(--foam)] font-semibold">EfficientNet-B2</span>
                        </div>
                    </div>
                )}

                {/* Live / Mock Toggle & Vessel Portal Button */}
                <div className="flex items-center space-x-3.5">
                    <div className="flex items-center space-x-2.5 bg-black/40 px-3 py-1.5 rounded-[var(--radius-card)] border border-white/10">
                        <span className="text-[9px] font-mono tracking-wider text-white/40 uppercase">DATA STREAM:</span>
                        <div className="flex items-center space-x-1 p-0.5 bg-black/60 rounded-[4px] border border-white/10">
                            <button
                                onClick={() => setMockMode(false)}
                                className={`px-2 py-0.5 text-[9.5px] font-mono rounded-[2px] transition-all cursor-pointer ${!isMockMode
                                    ? 'bg-[var(--slick-teal)] text-[var(--abyss)] font-bold shadow-[0_0_8px_rgba(0,242,254,0.4)]'
                                    : 'text-white/40 hover:text-white'
                                    }`}
                            >
                                LIVE
                            </button>
                            <button
                                onClick={() => setMockMode(true)}
                                className={`px-2 py-0.5 text-[9.5px] font-mono rounded-[2px] transition-all cursor-pointer ${isMockMode
                                    ? 'bg-[var(--sonar-amber)] text-[var(--abyss)] font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                    : 'text-white/40 hover:text-white'
                                    }`}
                            >
                                MOCK
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/vessel-dashboard')}
                        className="px-4 py-2 text-[11px] font-mono font-bold tracking-widest text-[var(--abyss)] bg-[var(--slick-teal)] hover:bg-[var(--slick-teal)]/90 rounded-[var(--radius-card)] transition-all select-none cursor-pointer uppercase shadow-[0_0_18px_rgba(0,242,254,0.4)] hover:shadow-[0_0_24px_rgba(0,242,254,0.6)] active:scale-95"
                    >
                        VESSEL PORTAL
                    </button>
                </div>
            </header>

            {/* ── Main Layout Compartment ── */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Triage Sidebar */}
                <TriageSidebar />

                {/* Map Console viewport area */}
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    <MapConsole />
                    {/* Scrubber floating control */}
                    {selectedIncidentId && <DriftScrubber />}
                </div>

                {/* Slide-in Detail Drawer */}
                <DetectionDrawer />
            </div>

            {/* ── Command Palette (⌘K) ── */}
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </div>
    );
};
export default WorkspaceDashboard;
