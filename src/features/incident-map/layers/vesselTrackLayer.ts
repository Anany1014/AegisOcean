import { PathLayer } from '@deck.gl/layers';
import { SuspectVessel } from '@/types/contract';
import { tokens, hexToRGBA } from '@/ui/tokens';

export function createVesselTrackLayer(
    suspects: SuspectVessel[],
    inspectedMmsi: string | null,
    onHover: (info: any) => void,
    onClick: (info: any) => void
) {
    return new PathLayer({
        id: 'vessel-tracks',
        data: suspects,
        pickable: true,
        widthScale: 1,
        widthMinPixels: 2,
        getPath: (d: SuspectVessel) => d.track.coordinates as [number, number][],
        getColor: (d: SuspectVessel) => {
            const isInspected = d.mmsi === inspectedMmsi;
            const isSelectedAny = inspectedMmsi !== null;

            // Dark vessel gets red tracks; transponding gets teal; inspected gets full opacity; others faded
            let fallbackColor = d.mmsi === null ? tokens.signalRed : tokens.slickTeal;
            if (isInspected) {
                return hexToRGBA(fallbackColor, 255);
            }
            return hexToRGBA(fallbackColor, isSelectedAny ? 40 : 120); // 20% opacity for faded tracks
        },
        getWidth: (d: SuspectVessel) => (d.mmsi === inspectedMmsi ? 4 : 2),
        onHover,
        onClick,
        updateTriggers: {
            getColor: [inspectedMmsi],
            getWidth: [inspectedMmsi],
        },
    });
}
