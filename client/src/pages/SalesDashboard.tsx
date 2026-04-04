import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/ui/Button';

interface Project {
  id: number;
  name: string;
  client_name: string;
  status: 'INTAKE_CREATED' | 'MEETING_SCHEDULED' | 'MEETING_COMPLETED' | 'MEETING_MISSED' | 'HANDOVER_PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'BLOCKED' | 'ON_HOLD';
  stage: string;
  pm_id?: number;
  sales_owner_id?: number;
  csm_id?: number;
  created_at: string;
  updated_at: string;
}

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, fetchProjects } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        await fetchProjects();
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProjects();
  }, [fetchProjects]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'INTAKE_CREATED': return 'neutral';
      case 'MEETING_SCHEDULED': return 'info';
      case 'MEETING_COMPLETED': return 'warning';
      case 'MEETING_MISSED': return 'warning';
      case 'HANDOVER_PENDING': return 'warning';
      case 'AWAITING_APPROVAL': return 'purple';
      case 'APPROVED': return 'success';
      case 'ACTIVE': return 'success';
      case 'REJECTED': return 'danger';
      case 'BLOCKED': return 'danger';
      case 'ON_HOLD': return 'warning';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'INTAKE_CREATED': return 'Intake Created';
      case 'MEETING_SCHEDULED': return 'Meeting Scheduled';
      case 'MEETING_COMPLETED': return 'Meeting Completed';
      case 'MEETING_MISSED': return 'Meeting Missed';
      case 'HANDOVER_PENDING': return 'Handover Pending';
      case 'AWAITING_APPROVAL': return 'Awaiting Approval';
      case 'APPROVED': return 'Approved';
      case 'ACTIVE': return 'Active';
      case 'REJECTED': return 'Rejected';
      case 'BLOCKED': return 'Blocked';
      case 'ON_HOLD': return 'On Hold';
      default: return status;
    }
  };

  const getActionForProject = (status: string) => {
    switch (status) {
      case 'INTAKE_CREATED':
        return { label: 'Schedule Meeting', action: 'schedule', disabled: false };
      case 'MEETING_SCHEDULED':
        return { label: 'Complete Meeting', action: 'complete', disabled: false };
      case 'HANDOVER_PENDING':
        return { label: 'Start Handover', action: 'handover', disabled: false };
      case 'AWAITING_APPROVAL':
        return { label: 'Waiting for Approval', action: 'waiting', disabled: true };
      default:
        return { label: 'View Details', action: 'view', disabled: false };
    }
  };

  const getProjectStats = () => {
    const stats = {
      total: projects.length,
      inProgress: projects.filter((p: Project) => ['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED'].includes(p.status)).length,
      awaitingApproval: projects.filter((p: Project) => p.status === 'AWAITING_APPROVAL').length,
      completed: projects.filter((p: Project) => ['APPROVED', 'ACTIVE'].includes(p.status)).length
    };
    return stats;
  };

  const handleStepClick = (step: number) => {
    switch (step) {
      case 1:
        navigate('/sales/intake');
        break;
      case 2:
        // Navigate to meetings or open modal
        break;
      case 3:
        // Navigate to handover section
        break;
    }
  };

  const handleProjectAction = (projectId: number, action: string) => {
    switch (action) {
      case 'schedule':
        // Navigate to meeting scheduling for this project
        navigate(`/project/${projectId}/schedule-meeting`);
        break;
      case 'complete':
        // Mark meeting as complete
        break;
      case 'handover':
        // Start handover process
        navigate(`/project/${projectId}/handover`);
        break;
      case 'view':
        navigate(`/project/${projectId}`);
        break;
    }
  };

  const insights = [
    {
      id: 1,
      title: 'Project deadline approaching',
      timestamp: '2 hours ago',
      type: 'warning',
      projectId: 1
    },
    {
      id: 2,
      title: 'Task overdue by 3 days',
      timestamp: '1 day ago',
      type: 'danger',
      projectId: 2
    },
    {
      id: 3,
      title: 'New handover request received',
      timestamp: '3 days ago',
      type: 'info',
      projectId: 3
    }
  ];

  const stats = getProjectStats();
  const hasProjects = projects.length > 0;

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full blur-2xl"></div>
      </div>

      {/* LEFT SIDEBAR */}
      <div className="w-60 bg-gray-50 border-r border-gray-200 relative z-10">
        {/* Sidebar Container */}
        <div className="p-4 space-y-2">
          {/* Menu Items */}
          <div className="space-y-1">
            {/* Sales Dashboard - Active */}
            <div className="flex items-center space-x-3 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1h3a1 1 0 001-1V10z" />
              </svg>
              <span className="font-medium">Sales Dashboard</span>
            </div>
            
            {/* All Projects */}
            <div className="flex items-center space-x-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="font-medium">All Projects</span>
            </div>
          </div>
        </div>
        
        {/* Bottom Section - User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
              SC
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">Sarah Chen</div>
              <div className="text-xs text-gray-500">Sales Representative</div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Dashboard</h1>
            <p className="text-lg text-gray-600">Drive projects through execution workflow</p>
          </div>

          {/* Hero Section - Reduced height */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={`text-center mb-12 relative ${hasProjects ? 'opacity-75' : ''}`}
          >
            {/* Subtle gradient glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 to-purple-50/30 rounded-2xl blur-lg"></div>
            
            <div className="relative">
              <h2 className={`${hasProjects ? 'text-4xl' : 'text-5xl'} font-black text-gray-900 mb-4 tracking-tight`}>
                Welcome to Chaos Coordinator
              </h2>
              <p className={`${hasProjects ? 'text-lg' : 'text-xl'} text-gray-600 font-medium`}>
                Your complete project lifecycle management platform starts here
              </p>
            </div>
          </motion.div>

          {/* Process Steps - Interactive */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`mb-12 relative ${hasProjects ? 'mb-8' : 'mb-16'}`}
          >
            <div className="flex items-center justify-center relative">
              {/* Connecting line */}
              <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-1 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200 rounded-full"></div>
              
              {/* Step 1 - Interactive */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleStepClick(1)}
                className="relative z-10 text-center mx-8 group cursor-pointer"
              >
                <div className={`w-${hasProjects ? '16' : '20'} h-${hasProjects ? '16' : '20'} bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow group-hover:bg-blue-700`}>
                  <span className={`${hasProjects ? 'text-2xl' : 'text-3xl'} font-black text-white`}>1</span>
                </div>
                <h3 className={`${hasProjects ? 'text-lg' : 'text-xl'} font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors`}>Start Intake</h3>
                <p className={`${hasProjects ? 'text-sm' : 'text-base'} text-gray-600 font-medium`}>Collect client and project details</p>
              </motion.div>

              {/* Step 2 - Interactive */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleStepClick(2)}
                className="relative z-10 text-center mx-8 group opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div className={`w-${hasProjects ? '14' : '16'} h-${hasProjects ? '14' : '16'} bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg transition-shadow group-hover:bg-purple-600`}>
                  <span className={`${hasProjects ? 'text-xl' : 'text-2xl'} font-bold text-white`}>2</span>
                </div>
                <h3 className={`${hasProjects ? 'text-lg' : 'text-lg'} font-semibold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors`}>Schedule Meeting</h3>
                <p className={`${hasProjects ? 'text-sm' : 'text-base'} text-gray-600`}>Set up kickoff and planning sessions</p>
              </motion.div>

              {/* Step 3 - Interactive */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleStepClick(3)}
                className="relative z-10 text-center mx-8 group opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div className={`w-${hasProjects ? '14' : '16'} h-${hasProjects ? '14' : '16'} bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg transition-shadow group-hover:bg-green-600`}>
                  <span className={`${hasProjects ? 'text-xl' : 'text-2xl'} font-bold text-white`}>3</span>
                </div>
                <h3 className={`${hasProjects ? 'text-lg' : 'text-lg'} font-semibold text-gray-900 mb-2 group-hover:text-green-700 transition-colors`}>Complete Handover</h3>
                <p className={`${hasProjects ? 'text-sm' : 'text-base'} text-gray-600`}>Transfer to execution team</p>
              </motion.div>
            </div>
          </motion.div>

          {/* Primary CTA Section - Dynamic */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className={`text-center ${hasProjects ? 'mb-8' : 'mb-16'}`}
          >
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="relative inline-block"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-xl opacity-50"></div>
              
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/sales/intake')}
                className={`relative bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 ${hasProjects ? 'px-8 py-4 text-lg' : 'px-12 py-6 text-xl'} font-bold shadow-xl hover:shadow-2xl transition-all duration-300 border-0`}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{hasProjects ? 'Create Another Project' : 'Start New Project'}</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </Button>
            </motion.div>
            
            <div className="mt-6">
              <p className={`${hasProjects ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 mb-2`}>
                {hasProjects ? 'Continue your project workflow' : 'Start your first project now'}
              </p>
              <p className={`${hasProjects ? 'text-base' : 'text-lg'} text-gray-600`}>
                {hasProjects ? 'Manage existing projects or create new ones' : 'The Sales Intake Form is the mandatory first step for all projects'}
              </p>
            </div>
          </motion.div>

          {/* Summary Bar - Only show if projects exist */}
          {hasProjects && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mb-12"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                  <div className="text-sm text-gray-600">Total Projects</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-2xl font-bold text-purple-600">{stats.awaitingApproval}</div>
                  <div className="text-sm text-gray-600">Awaiting Approval</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Project List - Only show if projects exist */}
          {hasProjects && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mb-12"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">My Active Projects</h2>
              <div className="space-y-4">
                {projects.map((project: Project) => {
                  const action = getActionForProject(project.status);
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                      className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{project.name}</h3>
                          <p className="text-sm text-gray-600">{project.client_name}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            project.status === 'INTAKE_CREATED' ? 'bg-blue-100 text-blue-800' :
                            project.status === 'MEETING_SCHEDULED' ? 'bg-purple-100 text-purple-800' :
                            project.status === 'HANDOVER_PENDING' ? 'bg-orange-100 text-orange-800' :
                            project.status === 'AWAITING_APPROVAL' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getStatusLabel(project.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">S</div>
                            <span>Sales Rep</span>
                          </div>
                          {project.csm_id && (
                            <div className="flex items-center space-x-1">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">C</div>
                              <span>CSM</span>
                            </div>
                          )}
                          {project.pm_id && (
                            <div className="flex items-center space-x-1">
                              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">P</div>
                              <span>PM</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500">
                            Last activity: {new Date(project.updated_at).toLocaleDateString()}
                          </span>
                          <Button
                            variant={action.disabled ? 'ghost' : 'primary'}
                            size="sm"
                            disabled={action.disabled}
                            onClick={() => handleProjectAction(project.id, action.action)}
                            className={`${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {action.label}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - INSIGHTS with connected actions */}
      <div className="w-80 bg-white border-l-2 border-gray-200 relative z-10">
        <div className="p-6">
          {/* Header */}
          <h2 className="text-xl font-bold text-gray-900 mb-6">Insights</h2>
          
          {/* Tabs */}
          <div className="flex space-x-6 mb-6 border-b border-gray-200">
            <button className="pb-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium">
              Alerts
            </button>
            <button className="pb-2 px-1 text-gray-500 hover:text-gray-700 font-medium">
              Blockers
            </button>
            <button className="pb-2 px-1 text-gray-500 hover:text-gray-700 font-medium">
              Actions
            </button>
          </div>

          {/* Alert Cards - Enhanced with project navigation */}
          <div className="space-y-4">
            {insights.map((alert) => (
              <motion.div
                key={alert.id}
                whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer"
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: alert.type === 'warning' ? '#eab308' : 
                                   alert.type === 'danger' ? '#ef4444' : '#3b82f6'
                }}
                onClick={() => navigate(`/project/${alert.projectId}`)}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    alert.type === 'warning' ? 'bg-yellow-500' :
                    alert.type === 'danger' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{alert.title}</h3>
                    <p className="text-xs text-gray-500">{alert.timestamp}</p>
                    <button className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium">
                      View Project →
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
