import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { IncidentListItem } from './IncidentListItem';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Filter, ArrowUpDown, RefreshCw, ChevronDown, ChevronRight, Layers, MapPin, Eye, Compass } from 'lucide-react';

const REGION_PRESETS = [
    {
        name: 'Mumbai Offings',
        polygon: [
            [72.52, 18.90],
            [72.58, 18.94],
            [72.64, 18.91],
            [72.60, 18.86],
            [72.52, 18.90]
        ]
    },
    {
        name: 'Chennai Anchorage',
        polygon: [
            [80.32, 13.12],
            [80.38, 13.15],
            [80.41, 13.09],
            [80.35, 13.06],
            [80.32, 13.12]
        ]
    },
    {
        name: 'Gulf of Khambhat',
        polygon: [
            [72.22, 21.05],
            [72.29, 21.11],
            [72.34, 21.06],
            [72.27, 21.00],
            [72.22, 21.05]
        ]
    }
];

const AttestationForm: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const { addCustomIncident, setSelectedIncidentId } = useUiStore();
    const [selectedRegionIdx, setSelectedRegionIdx] = useState(0);
    const [mmsi, setMmsi] = useState('367123456');
    const [windSpeed, setWindSpeed] = useState(4.5);
    const [backscatter, setBackscatter] = useState(-14.2);
    const [progressStep, setProgressStep] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAttest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            setProgressStep(1);
            setStatusText('Executing SAR U-Net Segmentation & Look-alike heuristics...');
            await new Promise(r => setTimeout(r, 1200));

            setProgressStep(2);
            setStatusText('Generating decentralized IPFS evidence bundle...');
            await new Promise(r => setTimeout(r, 1200));

            setProgressStep(3);
            setStatusText('Broadcasting statutory citation of fine to Polygon ledger...');

            const payload = {
                suspectMMSI: Number(mmsi),
                polygon: REGION_PRESETS[selectedRegionIdx].polygon,
                windSpeedMs: Number(windSpeed),
                backscatterMean: Number(backscatter)
            };

            const res = await apiClient.analyzeAndAnchorIncident(payload);

            if (res.success) {
                const newIncident = {
                    id: res.blockchainReceipt.incidentId.toString(),
                    detectedAt: res.blockchainReceipt.timestamp,
                    polygon: {
                        type: 'Polygon' as const,
                        coordinates: [payload.polygon]
                    },
                    areaKm2: res.mlResult.areaKm2,
                    perimeterToAreaRatio: res.mlResult.perimeterToAreaRatio,
                    windArtifactConfidence: res.mlResult.windArtifactConfidence,
                    status: 'unreviewed' as const
                };

                addCustomIncident(newIncident);
                setSelectedIncidentId(newIncident.id);

                useUiStore.setState((state) => ({
                    fineEnforcedIncidents: {
                        ...state.fineEnforcedIncidents,
                        [newIncident.id]: {
                            txHash: res.blockchainReceipt.transactionHash,
                            ipfsCid: res.blockchainReceipt.ipfsCID,
                            blockNumber: res.blockchainReceipt.blockNumber,
                            timestamp: res.blockchainReceipt.timestamp,
                            fineAmount: res.blockchainReceipt.fineAmountUSD,
                            vesselMmsi: mmsi
                        }
                    }
                }));

                setStatusText('Decentralized Attestation Anchored Successfully!');
                setProgressStep(4);
                await new Promise(r => setTimeout(r, 1000));
                onComplete();
            }
        } catch (err: any) {
            console.error(err);
            setStatusText(`Attestation Failed: ${err.message}`);
            setProgressStep(-1);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleAttest} className="space-y-4 font-mono text-[9px] text-[var(--foam-dim)] border border-[var(--hairline)] rounded-[var(--radius-card)] bg-[var(--abyss)] p-3">
            <div className="space-y-1">
                <label className="eyebrow block">Select SAR Coverage Region</label>
                <select
                    value={selectedRegionIdx}
                    onChange={(e) => setSelectedRegionIdx(Number(e.target.value))}
                    disabled={isSubmitting}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--hairline)] rounded-[var(--radius-chip)] p-1.5 text-white outline-none focus:border-[var(--slick-teal)]"
                >
                    {REGION_PRESETS.map((preset, idx) => (
                        <option key={preset.name} value={idx} className="bg-[var(--panel)]">
                            {preset.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-1">
                <label className="eyebrow block">Input Suspect MMSI</label>
                <input
                    type="text"
                    value={mmsi}
                    onChange={(e) => setMmsi(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--hairline)] rounded-[var(--radius-chip)] p-1.5 text-white outline-none focus:border-[var(--slick-teal)]"
                    placeholder="e.g. 367123456"
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="eyebrow block">Wind Speed (m/s)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={windSpeed}
                        onChange={(e) => setWindSpeed(Number(e.target.value))}
                        disabled={isSubmitting}
                        className="w-full bg-[var(--panel-raised)] border border-[var(--hairline)] rounded-[var(--radius-chip)] p-1.5 text-white outline-none focus:border-[var(--slick-teal)]"
                    />
                </div>
                <div className="space-y-1">
                    <label className="eyebrow block">Backscatter (dB)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={backscatter}
                        onChange={(e) => setBackscatter(Number(e.target.value))}
                        disabled={isSubmitting}
                        className="w-full bg-[var(--panel-raised)] border border-[var(--hairline)] rounded-[var(--radius-chip)] p-1.5 text-white outline-none focus:border-[var(--slick-teal)]"
                    />
                </div>
            </div>

            {isSubmitting || progressStep > 0 ? (
                <div className="p-2.5 bg-[var(--panel)] border border-[var(--hairline)] rounded-[var(--radius-card)] space-y-2 mt-2">
                    <span className="eyebrow block text-[var(--slick-teal)]">PIPELINE RUNNING</span>
                    <div className="space-y-1 text-[8px] tracking-wide">
                        <div className="flex justify-between items-center">
                            <span>1. ML Segmentation</span>
                            <span className={progressStep >= 1 ? "text-[var(--slick-teal)] font-bold" : ""}>{progressStep >= 2 ? "✓ DONE" : progressStep === 1 ? "RUNNING" : "PENDING"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>2. IPFS Pinned Proofs</span>
                            <span className={progressStep >= 2 ? "text-[var(--slick-teal)] font-bold" : ""}>{progressStep >= 3 ? "✓ DONE" : progressStep === 2 ? "RUNNING" : "PENDING"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>3. Smart Contract Anchor</span>
                            <span className={progressStep >= 3 ? "text-[var(--slick-teal)] font-bold" : ""}>{progressStep >= 4 ? "✓ DONE" : progressStep === 3 ? "RUNNING" : "PENDING"}</span>
                        </div>
                    </div>
                    <p className={`text-[8px] ${progressStep === -1 ? 'text-[var(--signal-red)]' : 'text-white/80'} animate-pulse`}>
                        {statusText}
                    </p>
                </div>
            ) : (
                <button
                    type="submit"
                    className="w-full py-1.5 bg-[var(--slick-teal)] text-[var(--abyss)] hover:bg-[var(--slick-teal)]/90 text-[10px] font-mono font-bold uppercase rounded-[var(--radius-chip)] transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_8px_rgba(0,242,254,0.15)] mt-2"
                >
                    <Compass size={11} className="animate-spin" style={{ animationDuration: '3s' }} />
                    <span>RUN ML & WEB3 ANCHOR</span>
                </button>
            )}
        </form>
    );
};

export const TriageSidebar: React.FC = () => {
    const {
        isMockMode, selectedIncidentId, setSelectedIncidentId,
        showEez, setShowEez,
        showPorts, setShowPorts,
        showDensity, setShowDensity,
        showRasterCharts, setShowRasterCharts,
        layerOpacity, setLayerOpacity,
        layersYear, setLayersYear,
        currentBasemap, setBasemap
    } = useUiStore();

    const [activeTab, setActiveTab] = useState<'detections' | 'layers'>('detections');
    const [filterStatus, setFilterStatus] = useState<'all' | 'unreviewed' | 'confirmed'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'area'>('date');
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const [isAttesting, setIsAttesting] = useState(false);

    const { data: incidents, isLoading, isError, refetch } = useQuery({
        queryKey: ['incidents', isMockMode],
        queryFn: () => apiClient.getIncidents(isMockMode),
    });

    // Filter and sort incident collections
    const processedIncidents = incidents
        ? incidents
            .filter((inc) => {
                if (filterStatus === 'all') return true;
                return inc.status === filterStatus;
            })
            .sort((a, b) => {
                if (sortBy === 'area') return b.areaKm2 - a.areaKm2;
                return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
            })
        : [];

    const years = [2025, 2024, 2023, 2022, 2021, 2020];

    return (
        <aside className="w-[320px] bg-[var(--panel)] border-r border-[var(--hairline)] flex flex-col h-full z-20">
            {/* Console Header */}
            <div className="p-4 border-b border-[var(--hairline)] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-[var(--slick-teal)] rounded-full animate-ping" />
                    <h2 className="font-display font-semibold tracking-wider text-xs uppercase text-[var(--foam)]">
                        CORE OPERATIONALS
                    </h2>
                </div>
                {activeTab === 'detections' && (
                    <button
                        onClick={() => refetch()}
                        className="p-1 hover:bg-[var(--panel-raised)] rounded-[var(--radius-card)] text-[var(--foam-dim)] hover:text-[var(--foam)] transition-colors"
                        title="Refresh incident list"
                    >
                        <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>

            {/* Tabs Selector Navigation */}
            <div className="border-b border-[var(--hairline)] flex text-[10px] font-mono tracking-wider font-bold">
                <button
                    onClick={() => setActiveTab('detections')}
                    className={`flex-1 py-3 text-center border-r border-[var(--hairline)] uppercase transition-all ${activeTab === 'detections'
                        ? 'bg-[var(--panel-raised)] text-[var(--foam)] border-b-2 border-b-[var(--slick-teal)]'
                        : 'text-[var(--foam-dim)] hover:text-[var(--foam)]'
                        }`}
                >
                    Detections ({processedIncidents.length})
                </button>
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 py-3 text-center uppercase transition-all ${activeTab === 'layers'
                        ? 'bg-[var(--panel-raised)] text-[var(--foam)] border-b-2 border-b-[var(--slick-teal)]'
                        : 'text-[var(--foam-dim)] hover:text-[var(--foam)]'
                        }`}
                >
                    Map Layers
                </button>
            </div>

            {activeTab === 'detections' ? (
                /* DETECTIONS LIST TAB */
                <>
                    {/* Form Toggle Button */}
                    <div className="p-2 border-b border-[var(--hairline)] bg-[var(--panel-raised)]">
                        <button
                            onClick={() => setIsAttesting(!isAttesting)}
                            className="w-full py-1.5 bg-[var(--slick-teal)] text-[var(--abyss)] hover:bg-[var(--slick-teal)]/80 text-[10px] font-mono tracking-widest font-bold uppercase rounded-[var(--radius-chip)] transition-all flex items-center justify-center space-x-1 cursor-pointer"
                        >
                            <span>{isAttesting ? "← BACK TO LIST" : "+ ATTEST NEW SAR DETECT"}</span>
                        </button>
                    </div>

                    {/* Sorting & Filter controls */}
                    <div className="p-3 bg-[var(--abyss)] border-b border-[var(--hairline)] flex flex-col space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--foam-dim)]">
                            <div className="flex items-center space-x-2">
                                <Filter size={10} />
                                <select
                                    value={filterStatus}
                                    onChange={(e: any) => setFilterStatus(e.target.value)}
                                    className="bg-transparent border-none text-[var(--slick-teal)] font-bold focus:outline-none cursor-pointer"
                                >
                                    <option value="all" className="bg-[var(--panel)]">ALL DETECTIONS</option>
                                    <option value="unreviewed" className="bg-[var(--panel)]">UNREVIEWED</option>
                                    <option value="confirmed" className="bg-[var(--panel)]">CONFIRMED</option>
                                </select>
                            </div>
                            <button
                                onClick={() => setSortBy((prev) => (prev === 'date' ? 'area' : 'date'))}
                                className="flex items-center space-x-1 hover:text-[var(--foam)] transition-colors"
                            >
                                <ArrowUpDown size={10} />
                                <span>SORT: {sortBy.toUpperCase()}</span>
                            </button>
                        </div>
                    </div>

                    {/* Main List */}
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {isAttesting ? (
                            <AttestationForm onComplete={() => { setIsAttesting(false); refetch(); }} />
                        ) : isLoading ? (
                            /* Sonar concentric pulsing loading arcs */
                            <div className="h-40 flex flex-col items-center justify-center space-y-4">
                                <div className="relative w-12 h-12 flex items-center justify-center">
                                    <div className="absolute w-12 h-12 border border-[var(--slick-teal)] rounded-full animate-ping opacity-25" />
                                    <div className="absolute w-8 h-8 border border-[var(--slick-teal)] rounded-full animate-ping opacity-50" />
                                    <div className="w-3 h-3 bg-[var(--slick-teal)] rounded-full shadow-[0_0_12px_var(--slick-teal)]" />
                                </div>
                                <span className="text-[10px] font-mono tracking-widest text-[var(--foam-dim)] uppercase">
                                    SCANNING SAR PASSES...
                                </span>
                            </div>
                        ) : isError ? (
                            <div className="p-4 border border-[var(--signal-red)] rounded-[var(--radius-card)] bg-[rgba(225,72,60,0.05)] text-center">
                                <p className="text-xs font-mono text-[var(--signal-red)] font-semibold mb-2">FEED SOURCE FAULT</p>
                                <p className="text-[10px] text-[var(--foam-dim)] leading-relaxed">Could not fetch incident list. Verify target API gateway is online.</p>
                            </div>
                        ) : processedIncidents.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-center p-6 text-[var(--foam-dim)] font-mono">
                                <div className="w-8 h-8 border border-dashed border-[var(--hairline)] rounded-full mb-3 flex items-center justify-center opacity-50">?</div>
                                <span className="text-xs font-semibold text-[var(--foam)] mb-1">NO ACTIVE DETECTIONS</span>
                                <span className="text-[9px] opacity-60">Scanning latest satellite SAR radar frames...</span>
                            </div>
                        ) : (
                            processedIncidents.map((incident) => (
                                <div key={incident.id} className="animate-fade-in">
                                    <IncidentListItem
                                        incident={incident}
                                        isSelected={incident.id === selectedIncidentId}
                                        onClick={() => setSelectedIncidentId(incident.id)}
                                    />
                                </div>
                            ))
                        )}
                    </div>

                    {/* Summary Footer bar */}
                    <div className="p-3 border-t border-[var(--hairline)] bg-[var(--abyss)] flex items-center justify-between text-[10px] font-mono text-[var(--foam-dim)] uppercase">
                        <span>ACTIVE DATABASE:</span>
                        <span className="text-[var(--foam)]">
                            {processedIncidents.length} target{processedIncidents.length !== 1 ? 's' : ''} shown
                        </span>
                    </div>
                </>
            ) : (
                /* MAP LAYERS PANEL TAB */
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[var(--foam-dim)] uppercase tracking-wider">Spatial Overlays</span>
                        <Badge variant="teal">INDIA EXCLUSIVE</Badge>
                    </div>

                    <div className="space-y-3">
                        {/* EEZ Layer */}
                        <Card className="!p-3 flex items-center justify-between transition-all duration-200">
                            <div className="flex items-center space-x-2">
                                <Layers size={13} className="text-[var(--slick-teal)]" />
                                <div>
                                    <div className="text-[11px] font-display font-medium text-white uppercase tracking-wider">India EEZ Boundaries</div>
                                    <div className="text-[9px] font-mono text-[var(--foam-dim)]">200 Nautical Mile limit</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEez(!showEez)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showEez ? 'bg-[var(--slick-teal)]' : 'bg-[var(--abyss)] border border-[var(--hairline)]'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showEez ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </Card>

                        {/* Ports Layer */}
                        <Card className="!p-3 flex items-center justify-between transition-all duration-200">
                            <div className="flex items-center space-x-2">
                                <MapPin size={13} className="text-[var(--slick-teal)]" />
                                <div>
                                    <div className="text-[11px] font-display font-medium text-white uppercase tracking-wider">Indian Port Limits</div>
                                    <div className="text-[9px] font-mono text-[var(--foam-dim)]">Major commercial hubs</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPorts(!showPorts)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showPorts ? 'bg-[var(--slick-teal)]' : 'bg-[var(--abyss)] border border-[var(--hairline)]'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showPorts ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </Card>

                        {/* Vessel Transit Counts (Heatmap Grid) */}
                        <Card className="!p-3 space-y-3 transition-all duration-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Eye size={13} className="text-[var(--slick-teal)]" />
                                    <div>
                                        <div className="text-[11px] font-display font-medium text-white uppercase tracking-wider">Ocean Transit Density</div>
                                        <div className="text-[9px] font-mono text-[var(--foam-dim)]">Historical AIS passage grids</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowDensity(!showDensity)}
                                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showDensity ? 'bg-[var(--slick-teal)]' : 'bg-[var(--abyss)] border border-[var(--hairline)]'}`}
                                >
                                    <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showDensity ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Year Selection for Heatmap */}
                            {showDensity && (
                                <div className="pt-2 border-t border-[var(--hairline)] space-y-2">
                                    <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--foam-dim)]">Select Observation Year</div>
                                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                                        {years.map((year) => {
                                            const isSelected = layersYear === year;
                                            return (
                                                <button
                                                    key={year}
                                                    onClick={() => setLayersYear(year)}
                                                    className={`py-1 rounded border text-[9px] text-center transition-all cursor-pointer font-mono ${isSelected
                                                        ? 'border-[var(--slick-teal)] bg-[rgba(0,242,254,0.08)] text-[var(--slick-teal)] font-bold'
                                                        : 'border-white/10 bg-white/5 text-white/50 hover:text-white'
                                                        }`}
                                                >
                                                    {year}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Coastal Raster Charts */}
                        <Card className="!p-3 flex items-center justify-between transition-all duration-200">
                            <div className="flex items-center space-x-2">
                                <Layers size={13} className="text-[var(--slick-teal)]" />
                                <div>
                                    <div className="text-[11px] font-display font-medium text-white uppercase tracking-wider">Hydrographic Charts</div>
                                    <div className="text-[9px] font-mono text-[var(--foam-dim)]">Bathymetry marine depth</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRasterCharts(!showRasterCharts)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showRasterCharts ? 'bg-[var(--slick-teal)]' : 'bg-[var(--abyss)] border border-[var(--hairline)]'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showRasterCharts ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </Card>
                    </div>

                    {/* Opacity Control */}
                    <Card className="!p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--foam-dim)] uppercase">
                            <span>Layer Opacity</span>
                            <span className="text-[var(--slick-teal)] font-bold">{(layerOpacity * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layerOpacity}
                            onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-[var(--abyss)] rounded-lg appearance-none cursor-pointer accent-[var(--slick-teal)] border border-[var(--hairline)]"
                        />
                    </Card>

                    {/* Basemap Selection */}
                    <div className="space-y-2.5">
                        <span className="text-[10px] font-mono text-[var(--foam-dim)] uppercase tracking-wider">Basemap Type</span>
                        <div className="space-y-2">
                            {/* ESRI World Ocean */}
                            <div
                                onClick={() => setBasemap('esri-ocean')}
                                className={`group relative overflow-hidden rounded-[var(--radius-card)] cursor-pointer border transition-all duration-200 ${currentBasemap === 'esri-ocean'
                                    ? 'border-[var(--slick-teal)] ring-1 ring-[var(--slick-teal)]/30 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                                    : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/20'
                                    }`}
                            >
                                <div className="h-10 w-full relative bg-slate-800">
                                    <img
                                        src="https://www.arcgis.com/sharing/rest/content/items/5ae9e13ae0b14c1aaee4e4ab49cc1444/info/thumbnail/thumbnail1568222835848.jpeg"
                                        alt="Esri World Ocean"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-center px-3.5">
                                        <span className="text-[9px] font-bold text-white tracking-widest uppercase font-mono">
                                            Esri World Ocean
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ESRI World Geographic Detail */}
                            <div
                                onClick={() => setBasemap('esri-topo')}
                                className={`group relative overflow-hidden rounded-[var(--radius-card)] cursor-pointer border transition-all duration-200 ${currentBasemap === 'esri-topo'
                                    ? 'border-[var(--slick-teal)] ring-1 ring-[var(--slick-teal)]/30 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                                    : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/20'
                                    }`}
                            >
                                <div className="h-10 w-full relative bg-slate-800">
                                    <img
                                        src="https://www.arcgis.com/sharing/rest/content/items/30e5fe3149c34df1ba922e6f5bbf8ae5/info/thumbnail/ago_downloaded.png"
                                        alt="Esri World Geographic Detail"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-center px-3.5">
                                        <span className="text-[9px] font-bold text-white tracking-widest uppercase font-mono">
                                            Esri World Geo Detail
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ESRI Dark Gray Canvas */}
                            <div
                                onClick={() => setBasemap('esri-dark')}
                                className={`group relative overflow-hidden rounded-[var(--radius-card)] cursor-pointer border transition-all duration-200 ${currentBasemap === 'esri-dark'
                                    ? 'border-[var(--slick-teal)] ring-1 ring-[var(--slick-teal)]/30 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                                    : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/20'
                                    }`}
                            >
                                <div className="h-10 w-full relative bg-slate-800">
                                    <img
                                        src="https://www.arcgis.com/sharing/rest/content/items/b04ab229ab34491987c6b41295325997/info/thumbnail/ago_downloaded.png"
                                        alt="Esri Dark Gray Canvas"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-center px-3.5">
                                        <span className="text-[9px] font-bold text-white tracking-widest uppercase font-mono">
                                            Esri Dark Gray Canvas
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compact Interactive Legend */}
                    <div className="border-t border-[var(--hairline)] pt-3 bg-transparent">
                        <button
                            onClick={() => setIsLegendOpen(!isLegendOpen)}
                            className="w-full flex items-center justify-between text-[9px] font-bold text-[var(--foam)] hover:text-[var(--slick-teal)] tracking-wider transition-colors cursor-pointer uppercase text-left focus:outline-none"
                        >
                            <span>Legend Guide</span>
                            {isLegendOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>

                        {isLegendOpen && (
                            <div className="mt-2.5 pl-3.5 space-y-2 border-l border-[var(--hairline)] animate-fade-in text-[9px] font-mono text-[var(--foam-dim)] uppercase">
                                <div className="flex items-center space-x-2">
                                    <span className="w-3.5 h-[2px] bg-[#f983e9] block border-dashed border border-[#f983e9]" />
                                    <span>EEZ Boundaries (Pink)</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 rounded-full bg-[#c6f1f7] inline-block ring-2 ring-white/10 shadow-[0_0_8px_#c6f1f7]" />
                                    <span>Ports Authorities (Teal)</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="w-3.5 h-2 bg-gradient-to-r from-[#b877ff]/0 to-[#b877ff]/60 inline-block rounded" />
                                    <span>Transit Counts (Violet Grid)</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
};
export default TriageSidebar;
