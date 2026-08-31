import React, { useRef, useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Marker, MapRef } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { PathLayer, ScatterplotLayer } from 'deck.gl';
import { useUiStore } from '@/stores/useUiStore';
import { useDriftPlaybackStore } from '@/stores/useDriftPlaybackStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { createSlickPolygonLayer } from './layers/slickPolygonLayer';
import { createDriftHeatmapLayer } from './layers/driftHeatmapLayer';
import { createVesselTrackLayer } from './layers/vesselTrackLayer';
import { AlertCircle } from 'lucide-react';
import BlockchainEvidencePanel from '../blockchain/BlockchainEvidencePanel';
import { DrawToolbar, useAnalyzeAnchor, type DrawState } from './DrawToolbar';
import { AnalyzeResultModal } from './AnalyzeResultModal';
import { VesselSimulator, type SimulationState } from '../vessel-simulation/VesselSimulator';
import 'maplibre-gl/dist/maplibre-gl.css';

const ESRI_OCEAN_STYLE: any = {
    version: 8,
    sources: {
        'esri-ocean-base': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri, GEBCO, NOAA, National Geographic, Garmin, HERE, Geonames.org, and other contributors'
        },
        'esri-ocean-ref': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256
        }
    },
    layers: [
        {
            id: 'esri-ocean-base-layer',
            type: 'raster',
            source: 'esri-ocean-base',
            minzoom: 0,
            maxzoom: 19
        },
        {
            id: 'esri-ocean-ref-layer',
            type: 'raster',
            source: 'esri-ocean-ref',
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

const ESRI_TOPO_STYLE: any = {
    version: 8,
    sources: {
        'esri-topo': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), (c) OpenStreetMap contributors, and the GIS User Community'
        }
    },
    layers: [
        {
            id: 'esri-topo-layer',
            type: 'raster',
            source: 'esri-topo',
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

const ESRI_DARK_GRAY_STYLE: any = {
    version: 8,
    sources: {
        'esri-dark-gray-base': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community'
        },
        'esri-dark-gray-ref': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256
        }
    },
    layers: [
        {
            id: 'esri-dark-gray-base-layer',
            type: 'raster',
            source: 'esri-dark-gray-base',
            minzoom: 0,
            maxzoom: 19
        },
        {
            id: 'esri-dark-gray-ref-layer',
            type: 'raster',
            source: 'esri-dark-gray-ref',
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

// Default map options if no viewport is present
const DEFAULT_VIEWPORT = {
    longitude: 72.50,
    latitude: 18.80,
    zoom: 9.5,
    pitch: 0,
    bearing: 0,
};

// India-specific spatial coordinates data
const INDIA_EEZ_PATH = [
    [68.1, 23.8],
    [65.0, 20.0],
    [68.0, 15.0],
    [71.0, 9.0],
    [75.0, 5.0],
    [80.0, 5.0],
    [83.0, 9.0],
    [85.0, 15.0],
    [89.5, 20.0],
    [89.0, 21.8]
];

const INDIAN_PORTS = [
    { name: 'Mumbai Port Authority', coordinates: [72.85, 18.95] },
    { name: 'Kochi Port Authority', coordinates: [76.27, 9.97] },
    { name: 'Chennai Port Authority', coordinates: [80.30, 13.09] },
    { name: 'Visakhapatnam Port Authority', coordinates: [83.30, 17.68] },
    { name: 'New Mangalore Port Authority', coordinates: [74.82, 12.87] },
    { name: 'Syama Prasad Mookerjee Port (Kolkata)', coordinates: [88.32, 22.50] }
];

const VESSEL_DENSITY_POINTS = [
    { coordinates: [70.0, 12.0], radius: 15000, value: 0.8 },
    { coordinates: [72.0, 11.5], radius: 22000, value: 0.95 },
    { coordinates: [74.0, 11.0], radius: 28000, value: 0.9 },
    { coordinates: [76.0, 10.5], radius: 25000, value: 0.85 },
    { coordinates: [78.0, 10.0], radius: 18000, value: 0.7 },
    { coordinates: [80.0, 9.5], radius: 12000, value: 0.6 },
    { coordinates: [72.5, 18.5], radius: 14000, value: 0.9 }
];

import { VESSEL_DETECTIONS } from '@/mocks/vessels';

export const MUMBAI_SHIPS = VESSEL_DETECTIONS;

export const MapConsole: React.FC = () => {
    const mapRef = useRef<MapRef>(null);

    const {
        isMockMode, selectedIncidentId, setSelectedIncidentId, inspectedVesselMmsi, setInspectedVesselMmsi,
        showEez, showPorts, showDensity, layerOpacity, layersYear, currentBasemap, fineEnforcedIncidents
    } = useUiStore();
    const { driftPlayhead, isForecastMode } = useDriftPlaybackStore();

    const [viewState, setViewState] = useState(DEFAULT_VIEWPORT);
    const [hoverInfo, setHoverInfo] = useState<any>(null);
    const [mouseCoords, setMouseCoords] = useState<{ lng: number; lat: number } | null>(null);
    const [currentTime, setCurrentTime] = useState<string>('');
    const [selectedShipIncidentId, setSelectedShipIncidentId] = useState<string | null>(null);

    // ── Draw-to-Analyze State ──────────────────────────────────────────────────
    const [drawState, setDrawState] = useState<DrawState>('idle');
    const [drawnPolygon, setDrawnPolygon] = useState<number[][]>([]);
    const { loading: analyzeLoading, result: analyzeResult, error: analyzeError, analyze, setResult } = useAnalyzeAnchor();
    const [showResultModal, setShowResultModal] = useState(false);

    // Keyboard shortcut ⌃D to start drawing
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                if (drawState === 'idle') startDraw();
                else cancelDraw();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [drawState]);

    const startDraw = useCallback(() => {
        setDrawState('drawing');
        setDrawnPolygon([]);
    }, []);

    const cancelDraw = useCallback(() => {
        setDrawState('idle');
        setDrawnPolygon([]);
    }, []);

    const clearPolygon = useCallback(() => {
        setDrawState('drawing');
        setDrawnPolygon([]);
    }, []);

    const handleMapClick = useCallback((e: any) => {
        if (drawState === 'drawing') {
            const { lng, lat } = e.lngLat;
            setDrawnPolygon(prev => {
                const next = [...prev, [lng, lat]];
                return next;
            });
        }
    }, [drawState]);

    const handleMapDblClick = useCallback((e: any) => {
        if (drawState === 'drawing' && drawnPolygon.length >= 3) {
            e.preventDefault();
            setDrawState('ready');
        }
    }, [drawState, drawnPolygon]);

    const handleAnalyze = useCallback(async (windSpeedMs: number) => {
        const poly = drawState === 'drawing' ? drawnPolygon : drawnPolygon;
        if (poly.length < 3) return;
        // Close polygon
        const closed = [...poly, poly[0]];
        setDrawState('loading');
        await analyze(closed, windSpeedMs);
        setDrawState('done');
        setShowResultModal(true);
    }, [drawState, drawnPolygon, analyze]);

    // Real-time ticking system clock hook
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            setCurrentTime(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
        };
        updateTime();
        const intervalId = setInterval(updateTime, 1000);
        return () => clearInterval(intervalId);
    }, []);

    // ── Fetch Incidents ──
    const { data: incidents, isError: isIncidentsError } = useQuery({
        queryKey: ['incidents', isMockMode],
        queryFn: () => apiClient.getIncidents(isMockMode),
    });

    // Find currently selected incident
    const currentIncident = incidents?.find((inc) => inc.id === selectedIncidentId);

    // ── Fetch Drift Trajectory ──
    const { data: driftTimeline } = useQuery({
        queryKey: ['drift', selectedIncidentId, isMockMode],
        queryFn: () => apiClient.getIncidentDrift(selectedIncidentId!, isMockMode),
        enabled: !!selectedIncidentId,
    });

    // Filter drift frame corresponding to the playhead offset
    const activeDriftFrame = driftTimeline?.find((f) => f.timestampOffsetHours === driftPlayhead) || null;

    // ── Fetch Suspects ──
    const { data: suspects } = useQuery({
        queryKey: ['suspects', selectedIncidentId, isMockMode],
        queryFn: () => apiClient.getSuspects(selectedIncidentId!, isMockMode),
        enabled: !!selectedIncidentId,
    });

    // ── Enhancement 1: 3D Fly-To Camera Animation ─────────────────────────────
    useEffect(() => {
        if (currentIncident && currentIncident.polygon.coordinates[0][0]) {
            const coords = currentIncident.polygon.coordinates[0];
            const lng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
            const lat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;

            if (mapRef.current) {
                mapRef.current.flyTo({
                    center: [lng, lat],
                    zoom: 11.5,
                    pitch: 45,
                    bearing: -12,
                    duration: 1400,
                    essential: true,
                });
            } else {
                setViewState(prev => ({ ...prev, longitude: lng, latitude: lat, zoom: 11.5, pitch: 45, bearing: -12 }));
            }
        }
    }, [currentIncident]);

    // Pan to inspected vessel coordinates with fly-to when selected from sidebar
    useEffect(() => {
        if (inspectedVesselMmsi) {
            const vessel = VESSEL_DETECTIONS.find((v) => v.mmsi === inspectedVesselMmsi);
            if (vessel) {
                if (mapRef.current) {
                    mapRef.current.flyTo({
                        center: [vessel.coordinates[0], vessel.coordinates[1]],
                        zoom: 12.5,
                        pitch: 55,
                        bearing: 10,
                        duration: 1000,
                        essential: true,
                    });
                } else {
                    setViewState(prev => ({ ...prev, longitude: vessel.coordinates[0], latitude: vessel.coordinates[1], zoom: 12.5 }));
                }
            }
        }
    }, [inspectedVesselMmsi]);

    // ── Vessel Simulation State ──────────────────────────────────────────────────
    const [simState, setSimState] = useState<SimulationState | null>(null);

    const handleFlyTo = useCallback((lon: number, lat: number) => {
        if (mapRef.current) {
            mapRef.current.flyTo({ center: [lon, lat], zoom: 10.5, pitch: 40, bearing: -8, duration: 1200 });
        }
    }, []);

    // Simulation deck.gl layers
    const simLayers = simState ? [
        new PathLayer({
            id: 'sim-history',
            data: [{ path: simState.historyPath }],
            getPath: (d: any) => d.path,
            getColor: [74, 111, 165, 120],
            getWidth: 2,
            widthMinPixels: 2,
        }),
        new PathLayer({
            id: 'sim-actual',
            data: simState.actualPath.length >= 2 ? [{ path: simState.actualPath }] : [],
            getPath: (d: any) => d.path,
            getColor: [0, 242, 254, 230],
            getWidth: 3,
            widthMinPixels: 3,
        }),
        new PathLayer({
            id: 'sim-predicted',
            data: simState.predictedPath.length >= 2 ? [{ path: simState.predictedPath }] : [],
            getPath: (d: any) => d.path,
            getColor: [184, 119, 255, 220],
            getWidth: 3,
            widthMinPixels: 3,
            getDashArray: [6, 4],
        }),
        new ScatterplotLayer({
            id: 'sim-actual-marker',
            data: simState.markerPos ? [{ pos: simState.markerPos }] : [],
            getPosition: (d: any) => d.pos,
            getRadius: 5,
            radiusMinPixels: 7,
            getFillColor: [0, 242, 254, 255],
            getLineColor: [255, 255, 255, 180],
            stroked: true,
            lineWidthMinPixels: 2,
        }),
        new ScatterplotLayer({
            id: 'sim-predicted-marker',
            data: simState.markerPos2 ? [{ pos: simState.markerPos2 }] : [],
            getPosition: (d: any) => d.pos,
            getRadius: 5,
            radiusMinPixels: 7,
            getFillColor: [184, 119, 255, 255],
            getLineColor: [255, 255, 255, 180],
            stroked: true,
            lineWidthMinPixels: 2,
        }),
    ] : [];

    // Drawn polygon deck.gl layer
    const drawnPolygonLayer = drawnPolygon.length >= 2 ? [
        new PathLayer({
            id: 'drawn-polygon',
            data: [{ path: drawState === 'ready' || drawState === 'loading' || drawState === 'done' ? [...drawnPolygon, drawnPolygon[0]] : drawnPolygon }],
            getPath: (d: any) => d.path,
            getColor: [184, 119, 255, 220],
            getWidth: 2,
            widthMinPixels: 2.5,
        }),
        new ScatterplotLayer({
            id: 'drawn-vertices',
            data: drawnPolygon.map((p, i) => ({ position: p, isFirst: i === 0 })),
            getPosition: (d: any) => d.position,
            getRadius: 4,
            radiusMinPixels: 4,
            getFillColor: (d: any) => d.isFirst ? [249, 131, 233, 255] : [184, 119, 255, 200],
            getLineColor: [255, 255, 255, 100],
            stroked: true,
            lineWidthMinPixels: 1,
        }),
    ] : [];

    // Construct deck.gl layers
    const layers = [
        // 1. Slick Geometries
        incidents ? createSlickPolygonLayer(
            incidents,
            selectedIncidentId,
            (info) => setHoverInfo(info.object ? { x: info.x, y: info.y, text: `Incident: ${info.object.properties.id}` } : null),
            (info) => {
                if (info.object && drawState === 'idle') {
                    setSelectedIncidentId(info.object.properties.id);
                }
            }
        ) : null,

        // 2. Drift Origin Probability Heatmap
        selectedIncidentId ? createDriftHeatmapLayer(activeDriftFrame, isForecastMode) : null,

        // 3. Suspect Vessel AIS tracks
        ...(selectedIncidentId && suspects ? (createVesselTrackLayer(
            suspects,
            inspectedVesselMmsi,
            (info) => setHoverInfo(info.object ? { x: info.x, y: info.y, text: `${info.object.vesselName || 'Dark Vessel'} (${info.object.mmsi || 'No AIS'})` } : null),
            (info) => {
                if (info.object) {
                    setInspectedVesselMmsi(info.object.mmsi);
                }
            }
        ) as any[]) : []),

        // 4. India Exclusive Economic Zone (EEZ)
        showEez ? new PathLayer({
            id: 'india-eez',
            data: [{ path: INDIA_EEZ_PATH }],
            getPath: (d: any) => d.path,
            getColor: [249, 131, 233, Math.round(220 * layerOpacity)], // figma pink stop
            getWidth: 2.5,
            widthScale: 20,
            widthMinPixels: 2.5,
            dashJustified: true,
            getDashArray: [4, 4],
        }) : null,

        // 5. Indian Ports
        showPorts ? new ScatterplotLayer({
            id: 'indian-ports',
            data: INDIAN_PORTS,
            getPosition: (d: any) => d.coordinates,
            getRadius: 8000,
            radiusMinPixels: 6,
            radiusMaxPixels: 20,
            getFillColor: [198, 241, 247, Math.round(240 * layerOpacity)], // figma light blue stop
            getLineColor: [255, 255, 255, Math.round(180 * layerOpacity)],
            lineWidthMinPixels: 1.5,
            stroked: true,
            pickable: true,
            onHover: (info) => setHoverInfo(info.object ? { x: info.x, y: info.y, text: `Port: ${info.object.name}` } : null),
        }) : null,

        // 6. Regional Shipping Density Heatmap Grid
        showDensity ? new ScatterplotLayer({
            id: 'vessel-density',
            data: VESSEL_DENSITY_POINTS,
            getPosition: (d: any) => d.coordinates,
            getRadius: (d: any) => d.radius * (1 + (2025 - layersYear) * 0.1), // scale based on year selected
            getFillColor: (d: any) => [184, 119, 255, Math.round(120 * d.value * layerOpacity)], // figma violet stop
            stroked: false,
            pickable: false,
        }) : null,

        // 7. Drawn polygon layers
        ...drawnPolygonLayer,

        // 8. Vessel simulation layers (actual + predicted + history)
        ...simLayers,
    ].filter(Boolean);

    return (
        <div className="flex-1 h-full w-full relative bg-[var(--abyss)]">
            {/* Live Feed Error Banner */}
            {isIncidentsError && (
                <div className="absolute top-4 left-4 right-4 z-40 bg-[var(--signal-red)] border border-red-500 text-white px-4 py-2.5 rounded-[var(--radius-card)] shadow-lg flex items-center justify-between animate-fade-in font-display font-medium uppercase tracking-wider text-xs">
                    <div className="flex items-center space-x-2 text-xs font-mono">
                        <AlertCircle size={16} />
                        <span>Live Stream Unreachable. Switch to local simulation.</span>
                    </div>
                    <button
                        onClick={() => useUiStore.getState().setMockMode(true)}
                        className="px-2.5 py-1 bg-white text-[var(--abyss)] rounded-[var(--radius-chip)] text-[10px] font-bold tracking-wider hover:bg-opacity-90"
                    >
                        SWITCH TO MOCK
                    </button>
                </div>
            )}

            {/* Draw Toolbar — Enhancement 4 */}
            <DrawToolbar
                drawState={drawState === 'done' ? 'ready' : drawState}
                polygon={drawnPolygon}
                onStartDraw={startDraw}
                onCancelDraw={cancelDraw}
                onClearPolygon={clearPolygon}
                onAnalyze={handleAnalyze}
                loading={analyzeLoading}
            />

            {/* Vessel Path Simulator Panel */}
            <VesselSimulator
                onSimulationUpdate={setSimState}
                onFlyTo={handleFlyTo}
            />

            {/* MapLibre viewport */}
            <Map
                ref={mapRef}
                {...viewState}
                onMove={(evt: any) => setViewState(evt.viewState)}
                onMouseMove={(evt: any) => setMouseCoords(evt.lngLat ? { lng: evt.lngLat.lng, lat: evt.lngLat.lat } : null)}
                onMouseLeave={() => setMouseCoords(null)}
                onClick={handleMapClick}
                onDblClick={handleMapDblClick}
                doubleClickZoom={drawState !== 'drawing'}
                mapStyle={
                    currentBasemap === 'esri-ocean'
                        ? ESRI_OCEAN_STYLE
                        : currentBasemap === 'esri-topo'
                            ? ESRI_TOPO_STYLE
                            : ESRI_DARK_GRAY_STYLE
                }
                style={{ cursor: drawState === 'drawing' ? 'crosshair' : 'grab' }}
            >
                <NavigationControl position="top-right" />
                <DeckGL viewState={viewState} layers={layers} style={{ pointerEvents: 'none' }} />

                {/* Unified AIS Tracked Vessels (1 Glowing Blue Dot Representation) */}
                {VESSEL_DETECTIONS.map((ship) => {
                    const isEnforced = fineEnforcedIncidents[ship.incidentId]?.txHash;
                    const isSelected = inspectedVesselMmsi === ship.mmsi || (selectedIncidentId === ship.incidentId && inspectedVesselMmsi === null);
                    return (
                        <Marker
                            key={ship.mmsi}
                            longitude={ship.coordinates[0]}
                            latitude={ship.coordinates[1]}
                            anchor="center"
                        >
                            <div
                                onClick={(e) => {
                                    if (drawState !== 'idle') return;
                                    e.stopPropagation();
                                    setSelectedIncidentId(ship.incidentId);
                                    setInspectedVesselMmsi(ship.mmsi);
                                    setSelectedShipIncidentId(ship.incidentId);
                                }}
                                className="group relative flex items-center justify-center cursor-pointer p-2"
                                title={`${ship.shipName} (${ship.vesselType}) - MMSI: ${ship.mmsi}`}
                            >
                                {/* Glowing radar pulse wave */}
                                <span className={`absolute w-5 h-5 rounded-full opacity-60 animate-ping ${
                                    isEnforced ? 'bg-red-400' : 'bg-[#00f2fe]'
                                }`} />

                                {/* Single clean sleek blue dot */}
                                <span className={`relative block rounded-full transition-all duration-200 ${
                                    isEnforced
                                        ? 'w-3.5 h-3.5 bg-red-500 border-2 border-white shadow-[0_0_12px_rgba(239,68,68,0.9)]'
                                        : isSelected
                                            ? 'w-3.5 h-3.5 bg-[#00f2fe] border-2 border-white shadow-[0_0_14px_#00f2fe] ring-4 ring-cyan-400/40 scale-125'
                                            : 'w-3 h-3 bg-[#00f2fe] border-2 border-[#091522] shadow-[0_0_10px_#00f2fe] group-hover:scale-125'
                                }`} />

                                {/* Mini hover badge */}
                                <div className="absolute top-5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap">
                                    <div className="px-2.5 py-1 rounded-md text-[9px] font-mono font-bold bg-[#040d1a]/95 border border-cyan-500/30 text-slate-100 shadow-xl flex items-center space-x-1.5 backdrop-blur-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#00f2fe]" />
                                        <span className="text-[#00f2fe] font-semibold">{ship.shipName}</span>
                                        <span className="text-white/40">·</span>
                                        <span className="text-white/70">{ship.vesselType}</span>
                                        <span className="text-white/40">·</span>
                                        <span className={isEnforced ? 'text-red-400 font-bold' : 'text-amber-400 font-bold'}>
                                            ${(ship.totalFineUSD / 1000).toFixed(0)}k Fine
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Marker>
                    );
                })}
            </Map>

            {/* Previous Authentic Full-Screen Blockchain & IPFS Ledger Interface */}
            {selectedShipIncidentId && (
                <BlockchainEvidencePanel
                    incidentId={selectedShipIncidentId}
                    onClose={() => setSelectedShipIncidentId(null)}
                />
            )}

            {/* Custom themed floating coordinate tooltip */}
            {hoverInfo && (
                <div
                    className="absolute z-50 pointer-events-none bg-[var(--panel)] border border-[var(--hairline)] rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-mono text-[var(--foam)] shadow-[var(--shadow-panel)]"
                    style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 12 }}
                >
                    {hoverInfo.text}
                </div>
            )}

            {/* Dynamic Coordinates Watermark Overlay */}
            <div className="absolute bottom-4 left-4 z-20 pointer-events-none font-mono text-[9px] text-[var(--foam-dim)] opacity-40 leading-relaxed uppercase">
                GRID PROJECTION · EPSG:4325<br />
                CENTER · LNG {viewState.longitude.toFixed(5)} LAT {viewState.latitude.toFixed(5)}<br />
                ZOOM LVL · {viewState.zoom.toFixed(1)}
                {drawState !== 'idle' && (
                    <>
                        <br />
                        <span className="text-[#B877FF] opacity-100">
                            DRAW MODE · {drawnPolygon.length} VERTICES
                        </span>
                    </>
                )}
            </div>

            {/* Live Hover coordinates & updating clock box */}
            <div className="absolute bottom-4 right-4 z-20 bg-[#111c24] border border-white/10 px-3.5 py-1.5 font-mono text-[10px] text-white/70 rounded shadow-lg flex flex-col items-end space-y-1">
                <div>
                    WGS84 EPSG:4326 | {mouseCoords ? `${mouseCoords.lng.toFixed(4)}, ${mouseCoords.lat.toFixed(4)}` : `${viewState.longitude.toFixed(4)}, ${viewState.latitude.toFixed(4)}`}
                </div>
                {currentTime && (
                    <div className="text-[9px] text-[var(--slick-teal)] font-medium">
                        SYSTEM CLOCK · {currentTime}
                    </div>
                )}
            </div>

            {/* Analyze Result Modal — Enhancement 4 */}
            {showResultModal && (
                <AnalyzeResultModal
                    result={analyzeResult}
                    error={analyzeError}
                    onClose={() => {
                        setShowResultModal(false);
                        setResult(null);
                        setDrawState('idle');
                        setDrawnPolygon([]);
                    }}
                />
            )}
        </div>
    );
};
