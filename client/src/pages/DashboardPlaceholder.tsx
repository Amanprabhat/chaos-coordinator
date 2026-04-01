import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';

interface DashboardProps {
  role: string;
  title: string;
  description: string;
}

const DashboardPlaceholder: React.FC<DashboardProps> = ({ role, title, description }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    console.log('🚪 User logging out...');
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="sm" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                <p className="text-gray-600">{description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Logged in as:</span>
              <span className="text-sm font-medium text-gray-900">{user?.name}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {user?.role}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            <div className="text-6xl font-bold text-blue-600 mb-4">🚧</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {title} Dashboard
            </h2>
            <p className="text-gray-600 mb-6">
              Your dashboard will show your projects and tasks here.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="text-3xl font-bold text-blue-600 mb-2">📊</div>
                <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
                <p className="text-gray-600">View and manage your projects</p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-6">
                <div className="text-3xl font-bold text-green-600 mb-2">📋</div>
                <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
                <p className="text-gray-600">Track and complete tasks</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-6">
                <div className="text-3xl font-bold text-purple-600 mb-2">📈</div>
                <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
                <p className="text-gray-600">View performance metrics</p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
              <ul className="text-gray-600 space-y-2">
                <li>• Project overview with health scores</li>
                <li>• Task prioritization and assignment</li>
                <li>• Team collaboration tools</li>
                <li>• Performance analytics</li>
                <li>• Automated notifications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPlaceholder;
