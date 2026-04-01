import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    console.log('🚪 User not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role-based access control is specified
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log('🚫 Access denied for role:', user.role, 'Allowed roles:', allowedRoles);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-4">Access Denied</h1>
            <p className="text-red-600">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Your role: <span className="font-semibold">{user?.role}</span>
            </p>
            <p className="text-sm text-gray-600">
              Required roles: {allowedRoles.join(', ')}
            </p>
            <button
              onClick={() => window.history.back()}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated and has correct role, allow access
  console.log('✅ Access granted for user:', user?.name, 'Role:', user?.role);
  return <>{children}</>;
};

export default ProtectedRoute;
