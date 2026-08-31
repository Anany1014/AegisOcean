import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { WorkspaceDashboard } from '../features/layout/WorkspaceDashboard';
import { VesselDashboard } from '../features/layout/VesselDashboard';
import { LoginPage } from '../features/auth/LoginPage';


export const AppRoutes: React.FC = () => {
    // Port 5180 is the dedicated Blockchain & Smart Contracts Portal
    const isBlockchainPort = typeof window !== 'undefined' && window.location.port === '5180';

    return (
        <Routes>
            <Route path="/" element={isBlockchainPort ? <VesselDashboard /> : <WorkspaceDashboard />} />
            <Route path="/map" element={<WorkspaceDashboard />} />
            <Route path="/triage" element={<WorkspaceDashboard />} />
            <Route path="/incident/:id" element={<WorkspaceDashboard />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/vessel-dashboard" element={<VesselDashboard />} />
            <Route path="/blockchain" element={<VesselDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};
