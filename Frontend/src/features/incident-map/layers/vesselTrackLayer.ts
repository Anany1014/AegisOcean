import { PathLayer } from '@deck.gl/layers';
import { SuspectVessel } from '@/types/contract';
import { tokens, hexToRGBA } from '@/ui/tokens';

export function createVesselTrackLayer(
    suspects: SuspectVessel[],
    inspectedMmsi: string | null,
    onHover: (info: any) => void,
    onClick: (info: any) => void
) {
    const layers: any[] = [];

    // 1. Regular vessel tracks
    layers.push(
        new PathLayer({
            id: 'vessel-tracks-solid',
            data: suspects,
            pickable: true,
            widthScale: 1,
            widthMinPixels: 2,
            getPath: (d: SuspectVessel) => {
                if (d.mmsi === '244770842') {
                    // Split track to end at index 2 (transponder off)
                    return d.track.coordinates.slice(0, 3) as [number, number][];
                }
                return d.track.coordinates as [number, number][];
            },
            getColor: (d: SuspectVessel) => {
                const isInspected = d.mmsi === inspectedMmsi;
                const isSelectedAny = inspectedMmsi !== null;

                let fallbackColor = d.mmsi === null ? tokens.signalRed : tokens.slickTeal;
                if (isInspected) {
                    return hexToRGBA(fallbackColor, 255);
                }
                return hexToRGBA(fallbackColor, isSelectedAny ? 40 : 120);
            },
            getWidth: (d: SuspectVessel) => (d.mmsi === inspectedMmsi ? 4 : 2),
            onHover,
            onClick,
            updateTriggers: {
                getColor: [inspectedMmsi],
                getWidth: [inspectedMmsi],
            },
        })
    );

    // 2. Dead-reckoning / Blackout Gap segments
    // For MV Pacific Star, show dead-reckoned gap path
    const pacificStar = suspects.find(s => s.mmsi === '244770842');
    if (pacificStar) {
        const isInspected = inspectedMmsi === '244770842';
        const isSelectedAny = inspectedMmsi !== null;

        // Gap segment: coordinate index 2 to 3
        const gapCoords = pacificStar.track.coordinates.slice(2, 4) as [number, number][];

        layers.push(
            new PathLayer({
                id: 'vessel-track-gap',
                data: [{ path: gapCoords }],
                getPath: (d: any) => d.path,
                getColor: isInspected ? [255, 72, 60, 255] : [255, 72, 60, isSelectedAny ? 30 : 100], // vibrant red for gap
                getWidth: isInspected ? 3.5 : 2,
                widthMinPixels: 2,
                dashJustified: true,
                getDashArray: [6, 4], // dotted/dashed path
            })
        );

    }

    return layers;
}
