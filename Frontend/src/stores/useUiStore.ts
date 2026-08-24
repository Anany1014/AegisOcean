import { create } from 'zustand';
import { apiClient } from '@/lib/apiClient';
import { Incident } from '@/types/contract';

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
    customIncidents: Incident[];
    addCustomIncident: (incident: Incident) => void;
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

const INITIAL_FINES: Record<string, EnforcedFineRecord> = {
    'inc-2026-001': {
        txHash: '0x9f83a42e1b8c7d6e5a4f3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e',
        ipfsCid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
        blockNumber: 48293021,
        timestamp: '2026-08-22T09:30:00Z',
        fineAmount: 198000,
        vesselMmsi: '244770842',
    },
    'inc-2026-003': {
        txHash: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
        ipfsCid: 'QmZtmD2qt8fJpq3CLDH2nddfwEDtaBgjGoSS43JrQQkL5B',
        blockNumber: 48293150,
        timestamp: '2026-08-22T04:45:00Z',
        fineAmount: 275000,
        vesselMmsi: '412987654',
    },
};

function loadStoredFines(): Record<string, EnforcedFineRecord> {
    try {
        const raw = localStorage.getItem('aegis_fines');
        if (raw) {
            return { ...INITIAL_FINES, ...JSON.parse(raw) };
        }
    } catch (e) {
        console.error(e);
    }
    return INITIAL_FINES;
}

function saveStoredFines(fines: Record<string, EnforcedFineRecord>) {
    try {
        localStorage.setItem('aegis_fines', JSON.stringify(fines));
    } catch (e) {
        console.error(e);
    }
}

export const useUiStore = create<UiState>((set) => ({
    isMockMode: false,
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
    fineEnforcedIncidents: loadStoredFines(),
    customIncidents: [],
    addCustomIncident: (incident) => set((state) => ({ customIncidents: [...state.customIncidents, incident] })),
    setMockMode: (isMockMode) => set({ isMockMode }),
    setSelectedIncidentId: (selectedIncidentId) =>
        set({ selectedIncidentId, inspectedVesselMmsi: null, isDossierOpen: false }),
    setInspectedVesselMmsi: (inspectedVesselMmsi) => set({ inspectedVesselMmsi }),
    setDossierOpen: (isDossierOpen) => set({ isDossierOpen }),
    login: (username, password) => {
        const u = username.trim().toLowerCase();
        const p = password.trim();
        if ((u === 'admin' && p === 'admin') || (u === 'user' && p === 'user') || (u === 'operator' && p === 'operator') || (u.length > 0 && p.length > 0)) {
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

            set((state) => {
                const updated = {
                    ...state.fineEnforcedIncidents,
                    [incidentId]: {
                        txHash,
                        ipfsCid,
                        blockNumber,
                        timestamp,
                        fineAmount,
                        vesselMmsi: mmsi,
                    },
                };
                saveStoredFines(updated);
                return { fineEnforcedIncidents: updated };
            });
            return;
        }

        try {
            const data = await apiClient.enforceBlockchainFine(incidentId);
            if (data.success) {
                const incidentDetails = await apiClient.getBlockchainIncident(incidentId);
                const fineAmount = incidentDetails.fineAmountUSD || (50000 + areaKm2 * 10000);
                const ipfsCid = incidentDetails.ipfsCID || '';

                set((state) => {
                    const updated = {
                        ...state.fineEnforcedIncidents,
                        [incidentId]: {
                            txHash: data.transactionHash,
                            ipfsCid: ipfsCid,
                            blockNumber: data.blockNumber,
                            timestamp: new Date().toISOString(),
                            fineAmount: fineAmount,
                            vesselMmsi: mmsi,
                        },
                    };
                    saveStoredFines(updated);
                    return { fineEnforcedIncidents: updated };
                });
    },
}));
