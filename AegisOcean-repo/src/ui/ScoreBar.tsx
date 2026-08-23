import React from 'react';
import { scoreColor } from './tokens';

interface ScoreBarProps {
    label: string;
    score: number; // 0 to 1
    showPercentage?: boolean;
    className?: string;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
    label,
    score,
    showPercentage = true,
    className = '',
}) => {
    const percentStr = `${Math.round(score * 100)}%`;
    const color = scoreColor(score);

    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className="flex items-center justify-between">
                <span className="eyebrow">{label}</span>
                {showPercentage && (
                    <span className="data-value font-semibold" style={{ color }}>
                        {percentStr}
                    </span>
                )}
            </div>
            <div className="h-2 w-full bg-[var(--panel-raised)] rounded-[2px] overflow-hidden border border-[var(--hairline)]">
                <div
                    className="h-full rounded-[1px] transition-all duration-500 ease-out"
                    style={{
                        width: percentStr,
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}`,
                    }}
                />
            </div>
        </div>
    );
};
