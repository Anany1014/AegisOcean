// Design token constants — mirrors CSS variables for use in JS/TS (e.g., deck.gl layers)
export const tokens = {
    abyss: '#141414',
    panel: '#1c1c1c',
    panelRaised: '#242424',
    hairline: '#ffffff',
    foam: '#ffffff',
    foamDim: '#e4e4e4',
    slickTeal: '#B877FF',
    sonarAmber: '#F983E9',
    signalRed: '#ff5a50',
} as const;

/** Convert hex to [R, G, B, A] 0-255 array for deck.gl */
export function hexToRGBA(hex: string, alpha = 255): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, alpha];
}

/** Score → CSS variable name */
export function scoreColor(score: number): string {
    if (score > 0.7) return 'var(--signal-red)';
    if (score > 0.4) return 'var(--sonar-amber)';
    return 'var(--slick-teal)';
}

export type TokenKey = keyof typeof tokens;
