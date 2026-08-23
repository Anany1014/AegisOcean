import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { WorkspaceDashboard } from '../features/layout/WorkspaceDashboard';
import { LoginPage } from '../features/auth/LoginPage';
import { useUiStore } from '@/stores/useUiStore';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isAuthenticated = useUiStore((state) => state.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

export const AppRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><WorkspaceDashboard /></ProtectedRoute>} />
            <Route path="/incident/:id" element={<ProtectedRoute><WorkspaceDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};
