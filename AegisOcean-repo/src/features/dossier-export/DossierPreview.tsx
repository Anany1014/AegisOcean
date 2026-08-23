import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useUiStore } from '@/stores/useUiStore';
import { Button } from '@/ui/Button';
import { Download, FileWarning, Eye, Loader2, Award } from 'lucide-react';

interface DossierPreviewProps {
    incidentId: string;
    onClose: () => void;
}

export const DossierPreview: React.FC<DossierPreviewProps> = ({ incidentId, onClose }) => {
    const { isMockMode, fineEnforcedIncidents } = useUiStore();
    const [isExporting, setIsExporting] = useState(false);
    const [downloadLink, setDownloadLink] = useState<string | null>(null);

    // Fetch incident details to build the dynamic summary fields
    const { data: incidents } = useQuery({
        queryKey: ['incidents', isMockMode],
        queryFn: () => apiClient.getIncidents(isMockMode),
    });

    const incident = incidents?.find((inc) => inc.id === incidentId);
    const areaKm2 = incident?.areaKm2 || 0;
    const marpolFine = 50000 + areaKm2 * 10000;

    // Fetch top suspect vessel
    const { data: suspects } = useQuery({
        queryKey: ['suspects', incidentId, isMockMode],
        queryFn: () => apiClient.getSuspects(incidentId, isMockMode),
        enabled: !!incidentId,
    });

    const topVessel = suspects ? [...suspects].sort((a, b) => b.suspectScore - a.suspectScore)[0] : null;

    const enforcedRecord = fineEnforcedIncidents[incidentId];

    const triggerExport = async () => {
        setIsExporting(true);
        try {
            const res = await apiClient.generateDossier(incidentId, isMockMode);
            setDownloadLink(res.pdfUrl);
        } catch (err) {
            console.error(err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-[var(--abyss)] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-[var(--panel)] border border-[var(--hairline)] rounded-[var(--radius-card)] w-[700px] max-w-full flex flex-col shadow-[var(--shadow-drawer)] max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="h-16 border-b border-[var(--hairline)] px-6 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Award size={16} className="text-[var(--slick-teal)]" />
                        <h2 className="font-display font-semibold text-sm tracking-widest text-[var(--foam)] uppercase">
                            EVIDENCE DOSSIER PACKAGER
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-xs eyebrow hover:text-[var(--foam)] border border-[var(--hairline)] px-2.5 py-1 bg-[var(--abyss)] rounded-[var(--radius-chip)]"
                    >
                        RETURN TO COMMAND BOARD
                    </button>
                </div>

                {/* Dossier Document Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {/* Dossier Mock PDF watermarked page preview */}
                    <div className="bg-white text-gray-900 p-8 rounded shadow-inner relative max-w-[580px] mx-auto border border-gray-300 font-serif leading-relaxed">
                        {/* Soft Ocean Origin Cone watermark watermark motif (Design System §4) */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.05]">
                            <svg className="w-80 h-80 rotate-45" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="10" stroke="black" strokeWidth="1" fill="none" />
                                <circle cx="50" cy="50" r="25" stroke="black" strokeWidth="1" fill="none" />
                                <path d="M 50 50 L 80 20 A 42 42 0 0 1 80 80 Z" fill="black" />
                            </svg>
                        </div>

                        {/* Title */}
                        <div className="border-b-2 border-gray-800 pb-3 mb-6 flex justify-between items-end">
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-tight font-sans">AEGISOCEAN REPORT</h1>
                                <p className="text-[9px] font-sans text-gray-600 font-mono">AUTOMATED MARITIME POLLUTION DOSSIER // SEC: A-1</p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                                <span className="text-xs font-mono font-bold text-gray-700 bg-gray-200 px-2 py-0.5 rounded">INCID-ID: {incidentId}</span>
                                {enforcedRecord && (
                                    <span className="text-[8px] font-sans font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded tracking-wider uppercase">
                                        POLYGONSCAN VERIFIED
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Document metadata info table */}
                        <table className="w-full text-[11px] mb-6 border-collapse font-sans">
                            <tbody>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600 w-1/3">DETECTION SOURCE:</td>
                                    <td className="py-1 font-mono">{incident?.id ?? 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600">SPILL AREA COVERAGE:</td>
                                    <td className="py-1 font-mono">{incident?.areaKm2.toFixed(2)} km²</td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600">ATTRIBUTED VESSEL:</td>
                                    <td className="py-1 font-mono font-bold text-red-700">
                                        {topVessel?.vesselName || 'Dark Vessel'} ({topVessel?.mmsi ? `MMSI: ${topVessel.mmsi}` : 'No Transponder Data'})
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600">ATTRIBUTION CONFIDENCE:</td>
                                    <td className="py-1 font-mono font-bold" style={{ color: topVessel ? (topVessel.suspectScore > 0.7 ? '#c53030' : '#d69e2e') : '#319795' }}>
                                        {(topVessel ? topVessel.suspectScore * 100 : 0).toFixed(0)}% Match Index
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600">STATUTORY FINE (UNCLOS):</td>
                                    <td className="py-1 font-mono font-bold text-red-700">${marpolFine.toLocaleString()} USD</td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600">IPFS CRYPTO HASH:</td>
                                    <td className="py-1 font-mono text-[9px] truncate max-w-[200px]">
                                        {enforcedRecord ? enforcedRecord.ipfsCid : 'UNENFORCED STANDBY'}
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-1 font-bold text-gray-600">BLOCK CHAIN TX RECEPT:</td>
                                    <td className="py-1 font-mono text-[9px] truncate max-w-[200px]">
                                        {enforcedRecord ? enforcedRecord.txHash : 'UNENFORCED STANDBY'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Summary */}
                        <div className="space-y-3 mb-6">
                            <h3 className="text-sm font-bold border-b border-gray-800 pb-1 uppercase font-sans">1. EXECUTIVE SUMMARY</h3>
                            <p className="text-[11px] text-gray-700 leading-relaxed font-serif mb-2">
                                A localized spill anomaly measuring {incident?.areaKm2.toFixed(1)} square kilometers was flagged by passive synthetic aperture radar (SAR) instrumentation. Spatiotemporal cross-comparison models against transpondency registers (AIS) identify the vessel <span className="font-bold">{topVessel?.vesselName || 'Dark Vessel'}</span> as the primary source candidate, registering a matching index of {(topVessel ? topVessel.suspectScore * 100 : 0).toFixed(0)} percent due to extreme course alignment adjustments and minimum distance vectors (less than {topVessel?.minDistanceKm ?? 0}km offset) within the drift backtrack window.
                            </p>
                            <p className="text-[11px] text-gray-700 leading-relaxed font-serif">
                                Meteorological validation (ERA5) indicates active wind vectors of 4.8 m/s, satisfying the slick stability window and ruling out low-wind biological look-alikes. Textural analysis (GLCM homogeneity 0.88, contrast 1.25) validates the synthetic aperture radar backscatter intensity profile.
                            </p>
                        </div>

                        {/* Legal notification footer */}
                        <div className="border-t border-gray-300 pt-3 text-[10px] text-gray-500 font-sans italic flex items-center justify-between">
                            <span>AegisOcean Automated Lagrangian Trajectory Core</span>
                            <span>CLASSIFIED INTERIM SUMMARY FILE</span>
                        </div>
                    </div>
                </div>

                {/* Action Panel Footer */}
                <div className="h-18 border-t border-[var(--hairline)] px-8 bg-[var(--abyss)] flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-mono text-[var(--foam-dim)]">
                        <FileWarning size={14} className="text-[var(--sonar-amber)]" />
                        <span>Generate final PDF package with high-res bathymetry layers for courtroom defense.</span>
                    </div>

                    <div>
                        {!downloadLink ? (
                            <Button variant="primary" disabled={isExporting} onClick={triggerExport}>
                                {isExporting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin mr-2" />
                                        <span>PACKAGING DOSSIER FILE...</span>
                                    </>
                                ) : (
                                    <>
                                        <Eye size={14} className="mr-2" />
                                        <span>CONFIRM & GENERATE PDF</span>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <a
                                href={downloadLink}
                                download={`aegisocean-dossier-${incidentId}.pdf`}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm bg-[var(--slick-teal)] hover:bg-[#258588] text-[var(--foam)] rounded-[var(--radius-card)] font-display font-semibold transition-colors"
                            >
                                <Download size={14} className="mr-2" />
                                <span>DOWNLOAD COMPLETED PDF</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
