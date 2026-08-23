import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { IncidentListItem } from './IncidentListItem';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Filter, ArrowUpDown, RefreshCw, ChevronDown, ChevronRight, Layers, MapPin, Eye } from 'lucide-react';

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
                        {isLoading ? (
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
