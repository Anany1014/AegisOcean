import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'teal' | 'amber' | 'red' | 'neutral';
    className?: string;
    title?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'teal', className = '', title }) => {
    const colors = {
        teal: 'bg-[#B877FF]/10 text-[#B877FF] border-[#B877FF]/30',
        amber: 'bg-[#F983E9]/10 text-[#F983E9] border-[#F983E9]/30',
        red: 'bg-[var(--signal-red)]/10 text-[var(--signal-red)] border-[var(--signal-red)]/30',
        neutral: 'bg-white/5 text-white/70 border-white/10',
    };

    return (
        <span
            title={title}
            className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-chip)] border text-[10px] font-mono leading-none tracking-wider uppercase ${colors[variant]} ${className}`}
        >
            {children}
        </span>
    );
};
