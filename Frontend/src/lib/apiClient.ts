import mockIncidents from '@/mocks/incidents.json';
import mockDrift from '@/mocks/drift.json';
import mockSuspects from '@/mocks/suspects.json';
import { Incident, DriftFrame, SuspectVessel } from '@/types/contract';
import { useUiStore } from '@/stores/useUiStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Simple delay helper to simulate network latency for mocks
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const apiClient = {
    async getIncidents(isMockMode: boolean): Promise<Incident[]> {
        const customIncidents = useUiStore.getState().customIncidents || [];
        if (isMockMode) {
            await delay(600); // realistic latency
            return [...(mockIncidents as Incident[]), ...customIncidents];
        }
        try {
            const res = await fetch(`${API_BASE_URL}/incidents`);
            if (res.ok) {
                const data = await res.json();
                return [...data, ...customIncidents];
            }
            throw new Error('API request failed');
        } catch (err) {
            console.warn('Real API failed, dropping back to mock data:', err);
            return [...(mockIncidents as Incident[]), ...customIncidents];
        }
    },

    async getIncidentDrift(id: string, isMockMode: boolean): Promise<DriftFrame[]> {
        if (isMockMode) {
            await delay(500);
            return mockDrift as DriftFrame[];
        }
        try {
            const res = await fetch(`${API_BASE_URL}/incidents/${id}/drift`);
            if (!res.ok) throw new Error('API request failed');
            return await res.json();
        } catch (err) {
            console.warn('Real API failed for drift, redirecting to mock:', err);
            throw err;
        }
    },

    async getSuspects(id: string, isMockMode: boolean): Promise<SuspectVessel[]> {
        if (isMockMode) {
            await delay(700);
            return mockSuspects as SuspectVessel[];
        }
        try {
            const res = await fetch(`${API_BASE_URL}/incidents/${id}/suspects`);
            if (!res.ok) throw new Error('API request failed');
            return await res.json();
        } catch (err) {
            console.warn('Real API failed for suspects, redirecting to mock:', err);
            throw err;
        }
    },

    async generateDossier(id: string, isMockMode: boolean): Promise<{ pdfUrl: string }> {
        if (isMockMode) {
            await delay(1200);
            return { pdfUrl: '#' };
        }
        const res = await fetch(`${API_BASE_URL}/incidents/${id}/dossier`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to generate dossier');
        return await res.json();
    },

    async getBlockchainIncident(id: string): Promise<any> {
        const res = await fetch(`http://localhost:4000/api/blockchain/incident/${id}`);
        if (!res.ok) throw new Error('Failed to fetch blockchain incident');
        return await res.json();
    },

    async enforceBlockchainFine(id: string): Promise<any> {
        const res = await fetch(`http://localhost:4000/api/blockchain/enforce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incidentId: parseInt(id, 10) }),
        });
        if (!res.ok) throw new Error('Failed to enforce fine on blockchain');
        return await res.json();
    },

    async verifyBlockchainEvidence(ipfsCID: string, storedEvidenceHash: string): Promise<any> {
        const res = await fetch(`http://localhost:4000/api/blockchain/verify-evidence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ipfsCID, storedEvidenceHash }),
        });
        if (!res.ok) throw new Error('Failed to verify evidence');
        return await res.json();
    },
    async analyzeAndAnchorIncident(payload: {
        suspectMMSI: number;
        polygon: number[][];
        windSpeedMs: number;
        backscatterMean?: number;
    }): Promise<any> {
        const res = await fetch(`http://localhost:4000/api/ml/analyze-and-anchor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('ML & Web3 anchoring pipeline failed');
        return await res.json();
    },
};
