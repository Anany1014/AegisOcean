import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/useUiStore';

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

    // Sync route param with Zustand UI state
    useEffect(() => {
        if (id) {
            setSelectedIncidentId(id);
        } else {
            setSelectedIncidentId(null);
        }
    }, [id, setSelectedIncidentId]);

    return (
        <div className="h-screen w-screen flex flex-col bg-[var(--abyss)] overflow-hidden">
            {/* ── Top Command Bar (Figma Influenzilla style) ── */}
            <header className="h-16 border-b border-[var(--hairline)] bg-[var(--panel)] px-6 flex items-center justify-between z-40">
                <div className="flex items-center space-x-4">
                    {/* Rotating Figma Star with custom pulsating status ring */}
                    <div className="relative flex items-center justify-center pulse-bead text-[var(--slick-teal)] mr-1">
                        <FigmaStar className="animate-[spin_10s_linear_infinite]" size={24} />
                    </div>
                    <div>
                        <h1 className="font-display font-bold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF] flex items-center">
                            AEGISOCEAN <span className="text-white/40 mx-2">//</span> <span className="text-white font-medium text-[10px] tracking-widest">COMMAND CENTER</span>
                        </h1>
                        <p className="text-[8px] font-mono text-white/50 tracking-wider uppercase">ALL PASSIVE SENSORS ONLINE · SYSTEM VER 2.0.4</p>
                    </div>
                </div>

                {/* Dashboard Nav Actions in high-contrast layout */}
                <div className="hidden lg:flex items-center space-x-2 text-[10px] font-mono">
                    <span className="px-3 py-1.5 border border-white/20 text-white rounded-[var(--radius-chip)] bg-white/5 tracking-widest select-none">INCIDENTS</span>
                    <span className="px-3 py-1.5 border border-transparent text-white/60 hover:text-white rounded-[var(--radius-chip)] tracking-widest cursor-pointer select-none">VESSELS</span>
                    <span className="px-3 py-1.5 border border-transparent text-white/60 hover:text-white rounded-[var(--radius-chip)] tracking-widest cursor-pointer select-none">ANALYTICS</span>
                </div>
                {selectedIncidentId && (
                    <div className="hidden md:flex items-center space-x-6 text-xs font-mono border-l border-[var(--hairline)] pl-6">
                        <div>
                            <span className="opacity-50 mr-2 text-[10px] uppercase">Incident</span>
                            <span className="text-[var(--slick-teal)] font-semibold">{selectedIncidentId}</span>
                        </div>
                        <div>
                            <span className="opacity-50 mr-2 text-[10px] uppercase">Sensor</span>
                            <span className="text-[var(--foam)]">SAR SEGFORMER v1</span>
                        </div>
                    </div>
                )}

                {/* Live / Mock Mode Selection & Logout Grid */}
                <div className="flex items-center space-x-3.5">
                    <div className="flex items-center space-x-3 bg-[var(--abyss)] px-3 py-1.5 rounded-[var(--radius-card)] border border-[var(--hairline)]">
                        <span className="text-[10px] font-mono tracking-wider text-[var(--foam-dim)] uppercase">Data Stream:</span>
                        <div className="flex items-center space-x-1 p-0.5 bg-[var(--panel)] rounded-[4px] border border-[var(--hairline)]">
                            <button
                                onClick={() => setMockMode(false)}
                                className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] transition-colors cursor-pointer ${!isMockMode
                                    ? 'bg-[var(--slick-teal)] text-[var(--foam)] font-semibold'
                                    : 'text-[var(--foam-dim)] hover:text-[var(--foam)]'
                                    }`}
                            >
                                LIVE
                            </button>
                            <button
                                onClick={() => setMockMode(true)}
                                className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] transition-colors cursor-pointer ${isMockMode
                                    ? 'bg-[var(--sonar-amber)] text-[var(--abyss)] font-bold'
                                    : 'text-[var(--foam-dim)] hover:text-[var(--foam)]'
                                    }`}
                            >
                                MOCK
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/vessel-dashboard')}
                        className="px-3 py-1.5 text-[10px] font-mono tracking-widest text-[var(--slick-teal)] border border-[var(--slick-teal)]/20 hover:border-[var(--slick-teal)]/60 hover:bg-[var(--slick-teal)]/10 rounded-[var(--radius-chip)] transition-all select-none cursor-pointer uppercase"
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
        </div>
    );
};
export default WorkspaceDashboard;
