import React from 'react';
import { Incident } from '@/types/contract';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { Calendar } from 'lucide-react';

interface IncidentListItemProps {
    incident: Incident;
    isSelected: boolean;
    onClick: () => void;
}

export const IncidentListItem: React.FC<IncidentListItemProps> = ({
    incident,
    isSelected,
    onClick,
}) => {
    const dateFormatted = new Date(incident.detectedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const getStatusBadge = (status: Incident['status']) => {
        switch (status) {
            case 'confirmed':
                return <Badge variant="red">CONFIRMED</Badge>;
            case 'dismissed':
                return <Badge variant="neutral">DISMISSED</Badge>;
            default:
                return <Badge variant="teal">NEW</Badge>;
        }
    };

    const isHighWindArtifact = incident.windArtifactConfidence > 0.6;

    return (
        <Card
            interactive
            onClick={onClick}
            className={`relative !p-3 mb-2.5 transition-all duration-200 ${isSelected
                ? 'border-[#B877FF] bg-[var(--panel-raised)] shadow-[4px_4px_0px_rgba(184,119,255,0.15)]'
                : 'border-[var(--hairline)] hover:border-white/40'
                }`}
        >
            {/* Selected Indicator Bar */}
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#C6F1F7] via-[#F983E9] to-[#B877FF]" />
            )}

            {/* Header Info */}
            <div className="flex items-center justify-between mb-2">
                <span className="data-value text-[var(--foam)] font-bold tracking-wider">
                    {incident.id.toUpperCase()}
                </span>
                <div className="flex items-center space-x-1.5">
                    {isHighWindArtifact && (
                        <Badge variant="amber" title="High probability of false positive (wind artifact)">
                            WIND-WARPING
                        </Badge>
                    )}
                    {getStatusBadge(incident.status)}
                </div>
            </div>

            {/* Incident metrics content */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[var(--foam-dim)] border-t border-[rgba(37,56,74,0.3)] pt-2 mt-1.5">
                <div>
                    <span className="text-[9px] uppercase tracking-wider block opacity-50">Area coverage</span>
                    <span className="data-value text-[var(--foam)] font-semibold">
                        {incident.areaKm2.toFixed(1)} km²
                    </span>
                </div>
                <div>
                    <span className="text-[9px] uppercase tracking-wider block opacity-50">P/A ratio</span>
                    <span className="data-value text-[var(--foam)] font-semibold">
                        {incident.perimeterToAreaRatio.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Footer Timestamp */}
            <div className="flex items-center text-[10px] font-mono text-[var(--foam-dim)] opacity-60 mt-2.5 space-x-1">
                <Calendar size={10} />
                <span>{dateFormatted}</span>
            </div>
        </Card>
    );
};
