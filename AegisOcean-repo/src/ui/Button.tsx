import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'secondary',
    size = 'md',
    children,
    className = '',
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-display font-medium rounded-[var(--radius-card)] transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-white';

    const variants = {
        primary: 'bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF] hover:opacity-90 text-[var(--abyss)] font-bold shadow-sm active:scale-[0.98] border-none',
        secondary: 'bg-[var(--panel-raised)] hover:bg-[#2a2a2a] hover:border-white text-[var(--foam)] border border-[var(--hairline)] active:scale-[0.98]',
        danger: 'bg-[var(--signal-red)] hover:bg-[#ec594d] text-white font-semibold active:scale-[0.98] border-none',
    };

    const sizes = {
        sm: 'text-[11px] px-3 py-1.5 h-8 tracking-wider uppercase',
        md: 'text-xs px-4 py-2 h-10 tracking-widest uppercase',
        lg: 'text-sm px-5 py-3 h-12 tracking-widest uppercase',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
