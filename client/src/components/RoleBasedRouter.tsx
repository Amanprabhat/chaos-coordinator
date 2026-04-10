import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPlaceholder from '../pages/DashboardPlaceholder';
import SalesDashboard from '../pages/SalesDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import CSMDashboard from '../pages/CSMDashboard';
import AllProjectsPage from '../pages/AllProjectsPage';
import { SalesIntakePage } from '../features/sales';
import ProjectDashboard from '../pages/ProjectDashboard';

const RoleBasedRouter: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/sales-dashboard"
        element={
          <ProtectedRoute allowedRoles={['Sales']}>
            <SalesDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales/intake"
        element={
          <ProtectedRoute allowedRoles={['Sales']}>
            <SalesIntakePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/csm-dashboard"
        element={
          <ProtectedRoute allowedRoles={['CSM', 'Admin']}>
            <CSMDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pm-dashboard"
        element={
          <ProtectedRoute allowedRoles={['PM', 'Admin']}>
            <CSMDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/client-dashboard"
        element={
          <ProtectedRoute allowedRoles={['Client']}>
            <DashboardPlaceholder
              role="Client"
              title="Client Dashboard"
              description="View project progress and deliverables"
            />
          </ProtectedRoute>
        }
      />

      {/* /dashboard redirects to the correct role-specific dashboard */}
      <Route
        path="/dashboard"
        element={(() => {
          switch (user?.role) {
            case 'Sales':  return <Navigate to="/sales-dashboard" replace />;
            case 'CSM':    return <Navigate to="/csm-dashboard" replace />;
            case 'PM':     return <Navigate to="/pm-dashboard" replace />;
            case 'Admin':  return <Navigate to="/admin-dashboard" replace />;
            case 'Client': return <Navigate to="/client-dashboard" replace />;
            default:       return <Navigate to="/sales-dashboard" replace />;
          }
        })()}
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute allowedRoles={['Sales', 'CSM', 'PM', 'Admin']}>
            <AllProjectsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:id"
        element={
          <ProtectedRoute allowedRoles={['Sales', 'CSM', 'PM', 'Admin', 'Client']}>
            <ProjectDashboard />
          </ProtectedRoute>
        }
      />

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
