/// <reference types="vite/client" />

declare module 'react-map-gl/mapbox' {
    import * as React from 'react';
    export interface MapRef {
        getMap(): any;
        flyTo(options: any): void;
    }
    export const NavigationControl: React.FC<any>;
    const Map: React.FC<any>;
    export default Map;
}
