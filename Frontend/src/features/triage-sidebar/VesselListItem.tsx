import React from 'react';
import { VesselDetection } from '@/mocks/vessels';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { Ship, Navigation, AlertTriangle, ShieldCheck } from 'lucide-react';

interface VesselListItemProps {
    vessel: VesselDetection;
    isSelected: boolean;
    onClick: () => void;
}

export const VesselListItem: React.FC<VesselListItemProps> = ({
    vessel,
    isSelected,
    onClick,
}) => {
    const getRiskBadge = () => {
        if (vessel.status === 'high_risk') {
            return (
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center space-x-1">
                    <AlertTriangle size={9} className="mr-0.5" />
                    <span>HIGH RISK · {(vessel.suspectScore * 100).toFixed(0)}%</span>
                </span>
            );
        }
        if (vessel.status === 'monitored') {
            return (
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center space-x-1">
                    <span>MONITORED · {(vessel.suspectScore * 100).toFixed(0)}%</span>
                </span>
            );
        }
        return (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                <ShieldCheck size={9} className="mr-0.5" />
                <span>CLEARED</span>
            </span>
        );
    };

    return (
        <Card
            interactive
            onClick={onClick}
            className={`relative !p-3 mb-2.5 transition-all duration-200 ${isSelected
                ? 'border-[#00f2fe] bg-[var(--panel-raised)] shadow-[4px_4px_0px_rgba(0,242,254,0.2)]'
                : 'border-[var(--hairline)] hover:border-cyan-400/50'
                }`}
        >
            {/* Selected Indicator Bar */}
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#00f2fe] to-[#38bdf8]" />
            )}

            {/* Header Info */}
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                    {/* Glowing Blue Dot Indicator */}
                    <div className="relative flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00f2fe] shadow-[0_0_8px_#00f2fe]" />
                        <span className="absolute w-4 h-4 rounded-full bg-[#00f2fe] opacity-40 animate-ping" />
                    </div>
                    <span className="data-value text-[var(--foam)] font-bold tracking-wide text-xs">
                        {vessel.shipName}
                    </span>
                </div>
                {getRiskBadge()}
            </div>

            {/* Vessel Subtitle */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--foam-dim)] mb-2 pl-4.5">
                <span className="text-white/60">{vessel.vesselType}</span>
                <span className="text-cyan-400/80">MMSI {vessel.mmsi}</span>
            </div>

            {/* Vessel Telemetry Metrics */}
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono text-[var(--foam-dim)] border-t border-[rgba(37,56,74,0.3)] pt-2 mt-1 bg-[var(--abyss)]/50 p-1.5 rounded-[var(--radius-chip)]">
                <div>
                    <span className="text-[8px] uppercase tracking-wider block opacity-50">SPEED</span>
                    <span className="data-value text-[var(--foam)] font-semibold text-[10px]">
                        {vessel.speedKnots} kn
                    </span>
                </div>
                <div>
                    <span className="text-[8px] uppercase tracking-wider block opacity-50">HEADING</span>
                    <span className="data-value text-[var(--foam)] font-semibold text-[10px]">
                        {vessel.headingDeg}°
                    </span>
                </div>
                <div>
                    <span className="text-[8px] uppercase tracking-wider block opacity-50">EST. FINE</span>
                    <span className="data-value text-amber-400 font-semibold text-[10px]">
                        ${(vessel.totalFineUSD / 1000).toFixed(0)}k
                    </span>
                </div>
            </div>

            {/* Position Coordinates Footer */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--foam-dim)] opacity-70 mt-2">
                <div className="flex items-center space-x-1">
                    <Navigation size={9} className="text-cyan-400" />
                    <span>{vessel.coordinates[1].toFixed(2)}°N, {vessel.coordinates[0].toFixed(2)}°E</span>
                </div>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                    AIS LIVE
                </span>
            </div>
        </Card>
    );
};
