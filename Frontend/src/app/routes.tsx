import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { WorkspaceDashboard } from '../features/layout/WorkspaceDashboard';
import { VesselDashboard } from '../features/layout/VesselDashboard';
import { LoginPage } from '../features/auth/LoginPage';
import { useUiStore } from '@/stores/useUiStore';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useUiStore();
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

export const AppRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<WorkspaceDashboard />} />
            <Route path="/incident/:id" element={<WorkspaceDashboard />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
                path="/vessel-dashboard"
                element={
                    <ProtectedRoute>
                        <VesselDashboard />
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};
