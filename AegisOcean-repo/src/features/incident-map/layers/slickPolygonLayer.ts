import { GeoJsonLayer } from '@deck.gl/layers';
import { Incident } from '@/types/contract';
import { tokens, hexToRGBA } from '@/ui/tokens';

export function createSlickPolygonLayer(
    incidents: Incident[],
    selectedId: string | null,
    onHover: (info: any) => void,
    onClick: (info: any) => void
) {
    return new GeoJsonLayer({
        id: 'slick-polygons',
        data: incidents.map((inc) => ({
            type: 'Feature',
            id: inc.id,
            geometry: inc.polygon,
            properties: { ...inc },
        })),
        pickable: true,
        stroked: true,
        filled: true,
        extruded: false,
        lineWidthScale: 1,
        lineWidthMinPixels: 2,
        getFillColor: (f: any) => {
            const isSelected = f.properties.id === selectedId;
            return hexToRGBA(tokens.foam, isSelected ? 48 : 22); // 12-18% opacity, higher for selected
        },
        getLineColor: (f: any) => {
            const isSelected = f.properties.id === selectedId;
            if (isSelected) {
                return hexToRGBA(tokens.signalRed, 255);
            }
            return f.properties.status === 'confirmed'
                ? hexToRGBA(tokens.sonarAmber, 200)
                : hexToRGBA(tokens.foam, 120);
        },
        getLineWidth: (f: any) => (f.properties.id === selectedId ? 3 : 1.5),
        onHover,
        onClick,
        updateTriggers: {
            getFillColor: [selectedId],
            getLineColor: [selectedId],
            getLineWidth: [selectedId],
        },
    });
}
