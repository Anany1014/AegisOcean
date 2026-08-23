import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { DriftFrame } from '@/types/contract';
import { tokens, hexToRGBA } from '@/ui/tokens';

export function createDriftHeatmapLayer(
    driftFrame: DriftFrame | null,
    _isForecast: boolean
) {
    if (!driftFrame || !driftFrame.originHeatmap || !driftFrame.originHeatmap.features.length) {
        return null;
    }

    // Exact gradient from Design system: teal (low probability) -> amber (medium) -> red (high probability core)
    const colorRange = [
        hexToRGBA(tokens.slickTeal, 50).slice(0, 3) as [number, number, number],
        hexToRGBA(tokens.slickTeal, 150).slice(0, 3) as [number, number, number],
        hexToRGBA(tokens.sonarAmber, 200).slice(0, 3) as [number, number, number],
        hexToRGBA(tokens.sonarAmber, 255).slice(0, 3) as [number, number, number],
        hexToRGBA(tokens.signalRed, 255).slice(0, 3) as [number, number, number],
    ];

    return new HeatmapLayer({
        id: 'drift-heatmap',
        data: driftFrame.originHeatmap.features,
        pickable: false,
        getPosition: (d: any) => d.geometry.coordinates,
        getWeight: (d: any) => d.properties?.weight ?? 1.0,
        radiusPixels: 45,
        intensity: 1,
        threshold: 0.05,
        colorRange,
        updateTriggers: {
            data: [driftFrame],
        },
    });
}
