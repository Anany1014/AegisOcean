/**
 * RadialGauge.tsx
 * ────────────────
 * Reusable animated SVG radial arc gauge.
 * Double-ring design — outer track ring + inner value arc.
 * Animates from 0 → value on mount via CSS transition.
 */

import React from 'react';

interface RadialGaugeProps {
  value: number;         // 0..1
  size?: number;         // px, default 88
  trackColor?: string;
  valueColor: string;
  label?: string;        // center label override (default: pct%)
  sublabel?: string;
  strokeWidth?: number;
  animate?: boolean;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  value,
  size = 88,
  trackColor = 'rgba(255,255,255,0.07)',
  valueColor,
  label,
  sublabel,
  strokeWidth = 6,
  animate = true,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - strokeWidth - 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, value)) * circumference;

  // Inner decorative ring
  const innerR = r - strokeWidth - 2;
  const innerCirc = 2 * Math.PI * innerR;
  const innerFilled = value * innerCirc * 0.6;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Outer track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        {/* Outer value arc */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={valueColor} strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: animate ? 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' : undefined }}
        />
        {/* Inner decorative arc */}
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={valueColor} strokeWidth={1.5} opacity={0.25}
          strokeDasharray={`${innerFilled} ${innerCirc}`} strokeLinecap="round" />
        {/* Glow dot at arc tip */}
        <circle
          cx={cx + r * Math.cos((filled / circumference) * 2 * Math.PI - Math.PI / 2)}
          cy={cy + r * Math.sin((filled / circumference) * 2 * Math.PI - Math.PI / 2)}
          r={strokeWidth / 2 + 1}
          fill={valueColor}
          style={{ filter: `drop-shadow(0 0 4px ${valueColor})`, transition: animate ? 'cx 0.9s, cy 0.9s' : undefined }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[13px] font-mono font-bold leading-none" style={{ color: valueColor }}>
          {label ?? `${Math.round(value * 100)}%`}
        </span>
        {sublabel && (
          <span className="text-[7px] font-mono text-white/30 mt-0.5 uppercase tracking-wide">{sublabel}</span>
        )}
      </div>
    </div>
  );
};
