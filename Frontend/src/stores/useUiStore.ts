import { create } from 'zustand';
import { apiClient } from '@/lib/apiClient';

export interface EnforcedFineRecord {
    txHash: string;
    ipfsCid: string;
    blockNumber: number;
    timestamp: string;
    fineAmount: number;
    vesselMmsi: string | null;
}

interface UiState {
    isMockMode: boolean;
    selectedIncidentId: string | null;
    inspectedVesselMmsi: string | null;
    isDossierOpen: boolean;
    isAuthenticated: boolean;
    // Spatial Layers toggles (India Specific)
    showEez: boolean;
    showPorts: boolean;
    showDensity: boolean;
    showRasterCharts: boolean;
    layerOpacity: number;
    layersYear: number;
    showLayersControl: boolean;
    layersTab: 'layers' | 'basemap';
    currentBasemap: 'esri-ocean' | 'esri-topo' | 'esri-dark';
    fineEnforcedIncidents: Record<string, EnforcedFineRecord>;
    setMockMode: (mode: boolean) => void;
    setSelectedIncidentId: (id: string | null) => void;
    setInspectedVesselMmsi: (mmsi: string | null) => void;
    setDossierOpen: (open: boolean) => void;
    login: (username: string, password: string) => boolean;
    logout: () => void;
    // Spatial setters
    setShowEez: (show: boolean) => void;
    setShowPorts: (show: boolean) => void;
    setShowDensity: (show: boolean) => void;
    setShowRasterCharts: (show: boolean) => void;
    setLayerOpacity: (opacity: number) => void;
    setLayersYear: (year: number) => void;
    setShowLayersControl: (show: boolean) => void;
    setLayersTab: (tab: 'layers' | 'basemap') => void;
    setBasemap: (basemap: 'esri-ocean' | 'esri-topo' | 'esri-dark') => void;
    enforceFine: (incidentId: string, mmsi: string | null, areaKm2: number) => Promise<void>;
}

export const useUiStore = create<UiState>((set) => ({
    isMockMode: false, // Default to FALSE to remove hardcode and fetch from live API by default
    selectedIncidentId: null,
    inspectedVesselMmsi: null,
    isDossierOpen: false,
    isAuthenticated: localStorage.getItem('sih_auth') === 'true',
    // Spatial layer defaults
    showEez: true,
    showPorts: true,
    showDensity: false,
    showRasterCharts: false,
    layerOpacity: 0.8,
    layersYear: 2025,
    showLayersControl: true,
    layersTab: 'layers',
    currentBasemap: 'esri-dark',
    fineEnforcedIncidents: {},
    setMockMode: (isMockMode) => set({ isMockMode }),
    setSelectedIncidentId: (selectedIncidentId) =>
        set({ selectedIncidentId, inspectedVesselMmsi: null, isDossierOpen: false }),
    setInspectedVesselMmsi: (inspectedVesselMmsi) => set({ inspectedVesselMmsi }),
    setDossierOpen: (isDossierOpen) => set({ isDossierOpen }),
    login: (username, password) => {
        if (username === 'admin' && password === 'admin') {
            localStorage.setItem('sih_auth', 'true');
            set({ isAuthenticated: true });
            return true;
        }
        return false;
    },
    logout: () => {
        localStorage.removeItem('sih_auth');
        set({ isAuthenticated: false, selectedIncidentId: null, inspectedVesselMmsi: null, isDossierOpen: false });
    },
    setShowEez: (showEez) => set({ showEez }),
    setShowPorts: (showPorts) => set({ showPorts }),
    setShowDensity: (showDensity) => set({ showDensity }),
    setShowRasterCharts: (showRasterCharts) => set({ showRasterCharts }),
    setLayerOpacity: (layerOpacity) => set({ layerOpacity }),
    setLayersYear: (layersYear) => set({ layersYear }),
    setShowLayersControl: (showLayersControl) => set({ showLayersControl }),
    setLayersTab: (layersTab) => set({ layersTab }),
    setBasemap: (currentBasemap) => set({ currentBasemap }),
    enforceFine: async (incidentId, mmsi, areaKm2) => {
        const isMockMode = useUiStore.getState().isMockMode;
        if (isMockMode) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const fineAmount = 50000 + areaKm2 * 10000;
            const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            const ipfsCid = 'QmP' + Array.from({ length: 43 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
            const blockNumber = 48293021 + Math.floor(Math.random() * 1000);
            const timestamp = new Date().toISOString();

            set((state) => ({
                fineEnforcedIncidents: {
                    ...state.fineEnforcedIncidents,
                    [incidentId]: {
                        txHash,
                        ipfsCid,
                        blockNumber,
                        timestamp,
                        fineAmount,
                        vesselMmsi: mmsi
                    }
                }
            }));
            return;
        }

        try {
            const data = await apiClient.enforceBlockchainFine(incidentId);
            if (data.success) {
                // Fetch incident details to retrieve the IPFS CID and fine details
                const incidentDetails = await apiClient.getBlockchainIncident(incidentId);
                const fineAmount = incidentDetails.fineAmountUSD || (50000 + areaKm2 * 10000);
                const ipfsCid = incidentDetails.ipfsCID || '';

                set((state) => ({
                    fineEnforcedIncidents: {
                        ...state.fineEnforcedIncidents,
                        [incidentId]: {
                            txHash: data.transactionHash,
                            ipfsCid: ipfsCid,
                            blockNumber: data.blockNumber,
                            timestamp: new Date().toISOString(),
                            fineAmount: fineAmount,
                            vesselMmsi: mmsi
                        }
                    }
                }));
            }
        } catch (err) {
            console.error("Failed to enforce fine on blockchain:", err);
            throw err;
        }
    },
}));
