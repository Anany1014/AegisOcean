import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    onClick,
    interactive = false,
}) => {
    return (
        <div
            onClick={onClick}
            className={`
        bg-[var(--panel)]
        border border-[var(--hairline)]
        rounded-[var(--radius-card)]
        p-4
        shadow-[var(--shadow-panel)]
        transition-all duration-200
        ${interactive ? 'cursor-pointer hover:bg-[var(--panel-raised)] hover:border-white hover:shadow-[4px_4px_0px_var(--slick-teal)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none' : ''}
        ${className}
      `}
        >
            {children}
        </div>
    );
};
