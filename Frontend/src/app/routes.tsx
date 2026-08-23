import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { WorkspaceDashboard } from '../features/layout/WorkspaceDashboard';
import { VesselDashboard } from '../features/layout/VesselDashboard';

export const AppRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<WorkspaceDashboard />} />
            <Route path="/incident/:id" element={<WorkspaceDashboard />} />
            <Route path="/vessel-dashboard" element={<VesselDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};
