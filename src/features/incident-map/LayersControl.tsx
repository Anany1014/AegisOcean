import React, { useState } from 'react';
import { useUiStore } from '@/stores/useUiStore';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

export const LayersControl: React.FC = () => {
    const {
        showEez, setShowEez,
        showPorts, setShowPorts,
        showDensity, setShowDensity,
        showRasterCharts, setShowRasterCharts,
        layerOpacity, setLayerOpacity,
        layersYear, setLayersYear,
        showLayersControl, setShowLayersControl,
        layersTab, setLayersTab
    } = useUiStore();

    const [isLegendOpen, setIsLegendOpen] = useState(false);

    if (!showLayersControl) {
        // Floating trigger button if closed
        return (
            <button
                onClick={() => setShowLayersControl(true)}
                className="absolute top-4 left-4 z-40 bg-[var(--panel)] hover:bg-[var(--panel-raised)] border border-white/20 px-3 py-2 rounded-[var(--radius-card)] text-white/80 hover:text-white shadow-[var(--shadow-panel)] text-[10px] font-mono tracking-widest uppercase flex items-center space-x-1.5 cursor-pointer transition-all"
            >
                <Info size={12} className="text-[var(--slick-teal)]" />
                <span>LAYERS PANEL</span>
            </button>
        );
    }

    const years = [2025, 2024, 2023, 2022, 2021, 2020];

    return (
        <div className="absolute top-4 left-4 z-40 w-[290px] bg-[#111c24] border border-white/15 rounded-[var(--radius-card)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 font-body select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <h3 className="text-xs font-bold text-white tracking-wider font-display uppercase">Layers</h3>
                <button
                    onClick={() => setShowLayersControl(false)}
                    className="text-white/40 hover:text-white text-xs font-mono lowercase cursor-pointer focus:outline-none"
                >
                    x
                </button>
            </div>

            {layersTab === 'layers' ? (
                /* Tab Content - Layers Checklist */
                <div className="space-y-4 text-xs text-white/90">
                    {/* Toggle Options */}
                    <div className="space-y-3.5">
                        {/* EEZ Option */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-white/80 tracking-wide">U.S. Exclusive Economic Zone</span>
                            <button
                                type="button"
                                onClick={() => setShowEez(!showEez)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showEez ? 'bg-[#0074d9]' : 'bg-white/10'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showEez ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Ports Option */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-white/80 tracking-wide">BOEM Lease Blocks</span>
                            <button
                                type="button"
                                onClick={() => setShowPorts(!showPorts)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showPorts ? 'bg-[#0074d9]' : 'bg-white/10'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showPorts ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Density Option */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-white/80 tracking-wide">2025 Vessel Transit Counts</span>
                            <button
                                type="button"
                                onClick={() => setShowDensity(!showDensity)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showDensity ? 'bg-[#0074d9]' : 'bg-white/10'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showDensity ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Years Selection Row */}
                        <div className="pl-4 space-y-2">
                            <div className="grid grid-cols-3 gap-1 text-[10px]">
                                {years.map((year) => {
                                    const isSelected = layersYear === year;
                                    return (
                                        <button
                                            key={year}
                                            onClick={() => setLayersYear(year)}
                                            className={`py-1 rounded border text-[9px] text-center transition-all cursor-pointer font-mono ${isSelected
                                                ? 'border-[#0074d9] bg-[#0074d9]/10 text-white font-bold'
                                                : 'border-white/10 bg-white/5 text-white/50 hover:text-white'
                                                }`}
                                        >
                                            {year}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Raster Charts */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-white/80 tracking-wide">NOAA Raster Charts</span>
                            <button
                                type="button"
                                onClick={() => setShowRasterCharts(!showRasterCharts)}
                                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${showRasterCharts ? 'bg-[#0074d9]' : 'bg-white/10'}`}
                            >
                                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${showRasterCharts ? 'translate-x-3.5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Opacity control */}
                    <div className="pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-white/60 mb-1.5 uppercase">
                            <span>Opacity:</span>
                            <span className="text-[#ff5a50] hover:underline cursor-pointer">Metadata</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layerOpacity}
                            onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#0074d9]/20 rounded-lg appearance-none cursor-pointer accent-[#0074d9]"
                        />
                    </div>

                    {/* Collapsible Legend */}
                    <div className="border-t border-white/5 pt-2">
                        <button
                            onClick={() => setIsLegendOpen(!isLegendOpen)}
                            className="w-full flex items-center space-x-1.5 text-[9px] font-bold text-white hover:text-[#0074d9] tracking-wider transition-colors cursor-pointer uppercase text-left focus:outline-none"
                        >
                            {isLegendOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span>Legend</span>
                        </button>

                        {isLegendOpen && (
                            <div className="mt-2 pl-4 space-y-2 border-l border-white/10 animate-fade-in text-[9px] font-mono text-white/50 uppercase">
                                <div className="flex items-center space-x-2">
                                    <span className="w-3.5 h-[2px] bg-[#f983e9] block border-dashed border border-[#f983e9]" />
                                    <span>EEZ Boundaries</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 rounded-full bg-[#c6f1f7] inline-block ring-2 ring-white/10 shadow-[0_0_8px_#c6f1f7]" />
                                    <span>Block Areas</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="w-3.5 h-2 bg-gradient-to-r from-[#b877ff]/0 to-[#b877ff]/60 inline-block rounded" />
                                    <span>Vessel Transit Heat</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Tab Content - Basemap Choice */
                <div className="space-y-2 p-1 text-[10px] font-mono text-white/60 uppercase">
                    <div className="p-2 border border-white/15 rounded bg-[#0074d9]/10 text-white font-bold cursor-pointer">
                        🌐 OpenStreetMap Standard
                    </div>
                    <div className="p-2 border border-white/5 rounded hover:bg-white/5 cursor-not-allowed opacity-50">
                        🗺️ CartoDB Dark Matter
                    </div>
                    <div className="p-2 border border-white/5 rounded hover:bg-white/5 cursor-not-allowed opacity-50">
                        🛰️ Satellite Imagery
                    </div>
                </div>
            )}

            {/* Bottom Actions tabs */}
            <div className="flex items-center space-x-2 border-t border-white/10 mt-4 pt-3 text-[10px] font-mono font-bold tracking-wider">
                <button
                    onClick={() => setLayersTab('layers')}
                    className={`flex-1 py-1 rounded border text-center transition-all cursor-pointer ${layersTab === 'layers'
                        ? 'border-white text-white bg-white/5 font-extrabold'
                        : 'border-white/10 text-white/40 hover:text-white'
                        }`}
                >
                    LAYERS
                </button>
                <button
                    onClick={() => setLayersTab('basemap')}
                    className={`flex-1 py-1 rounded border text-center transition-all cursor-pointer ${layersTab === 'basemap'
                        ? 'border-white text-white bg-white/5 font-extrabold'
                        : 'border-white/10 text-white/40 hover:text-white'
                        }`}
                >
                    BASEMAP
                </button>
            </div>
        </div>
    );
};
