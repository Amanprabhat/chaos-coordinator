import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPlaceholder from '../pages/DashboardPlaceholder';
import SalesDashboard from '../pages/SalesDashboard';
import { SalesIntakePage } from '../features/sales';
import ProjectPage from '../pages/ProjectPage';

const RoleBasedRouter: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If authenticated, show role-based routing
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      
      {/* Role-based Dashboard Routes */}
      <Route 
        path="/sales-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['SALES']}>
            <SalesDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/sales/intake" 
        element={
          <ProtectedRoute allowedRoles={['SALES']}>
            <SalesIntakePage />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/csm-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['CSM']}>
            <DashboardPlaceholder 
              role="CSM" 
              title="Customer Success Dashboard" 
              description="Manage customer onboarding and success metrics" 
            />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/pm-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['PM']}>
            <DashboardPlaceholder 
              role="PM" 
              title="Project Management Dashboard" 
              description="Oversee project execution and team coordination" 
            />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/product-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['PRODUCT']}>
            <DashboardPlaceholder 
              role="Product" 
              title="Product Dashboard" 
              description="Manage product features and development roadmap" 
            />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardPlaceholder 
              role="ADMIN" 
              title="Admin Dashboard" 
              description="System administration and user management" 
            />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/client-dashboard" 
        element={
          <ProtectedRoute allowedRoles={['CLIENT']}>
            <DashboardPlaceholder 
              role="CLIENT" 
              title="Client Dashboard" 
              description="View project progress and deliverables" 
            />
          </ProtectedRoute>
        } 
      />
      
      {/* Default dashboard route - redirect based on user role */}
      <Route 
        path="/dashboard" 
        element={
          (() => {
            switch (user?.role) {
              case 'SALES':
                return <Navigate to="/sales-dashboard" replace />;
              case 'CSM':
                return <Navigate to="/csm-dashboard" replace />;
              case 'PM':
                return <Navigate to="/pm-dashboard" replace />;
              case 'PRODUCT':
                return <Navigate to="/product-dashboard" replace />;
              case 'ADMIN':
                return <Navigate to="/admin-dashboard" replace />;
              case 'CLIENT':
                return <Navigate to="/client-dashboard" replace />;
              default:
                return <Navigate to="/sales-dashboard" replace />; // Default fallback
            }
          })()
        } 
      />
      
      {/* Project Management - Available for PM, ADMIN, and CLIENT */}
      <Route 
        path="/project/:id" 
        element={
          <ProtectedRoute allowedRoles={['PM', 'ADMIN', 'CLIENT']}>
            <ProjectPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Fallback for authenticated users */}
      <Route 
        path="*" 
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default RoleBasedRouter;
