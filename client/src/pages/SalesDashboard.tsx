import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Button, Card, CardHeader, CardBody, CardFooter, StatusBadge, AlertCard } from '../components/ui';
import InsightsPanel from '../components/layout/InsightsPanel';
import { useProjectStore } from '../store/projectStore';

interface Project {
  id: number;
  name: string;
  client_name: string;
  status: 'INTAKE_CREATED' | 'MEETING_SCHEDULED' | 'MEETING_COMPLETED' | 'HANDOVER_PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'ACTIVE';
  stage: string;
  pm_id?: number;
  sales_owner_id?: number;
  csm_id?: number;
  created_at: string;
  updated_at: string;
}

interface Meeting {
  id: number;
  project_name: string;
  meeting_date_time: string;
  participants: string[];
  completed: boolean;
}

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, error, fetchProjects } = useProjectStore();
  
  // Fetch projects on component mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        await fetchProjects();
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    
    loadProjects();
  }, [fetchProjects]);

  const getActionRequiredProjects = () => {
    return projects.filter((p: Project) => 
      p.status === 'HANDOVER_PENDING' || 
      p.status === 'AWAITING_APPROVAL'
    );
  };

  const getProjectsByStatus = (status: string) => {
    return projects.filter((p: Project) => p.status === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'INTAKE_CREATED': return 'neutral';
      case 'MEETING_SCHEDULED': return 'info';
      case 'MEETING_COMPLETED': return 'warning';
      case 'HANDOVER_PENDING': return 'warning';
      case 'AWAITING_APPROVAL': return 'purple';
      case 'APPROVED': return 'success';
      case 'ACTIVE': return 'success';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'INTAKE_CREATED': return 'Intake Created';
      case 'MEETING_SCHEDULED': return 'Meeting Scheduled';
      case 'MEETING_COMPLETED': return 'Meeting Completed';
      case 'HANDOVER_PENDING': return 'Handover Pending';
      case 'AWAITING_APPROVAL': return 'Awaiting Approval';
      case 'APPROVED': return 'Approved';
      case 'ACTIVE': return 'Active';
      default: return status;
    }
  };

  const sidebarItems = [
    { id: 'dashboard', label: 'Sales Dashboard', href: '/sales-dashboard', icon: '📊' },
    { id: 'intake', label: 'New Intake', href: '/sales/intake', icon: '➕' },
    { id: 'projects', label: 'All Projects', href: '/sales/projects', icon: '📁' },
  ];

  const user = {
    name: 'Sarah Chen',
    email: 'sarah@chaos.co',
    role: 'Sales Representative',
  };

  const insights = [
    {
      title: '3 projects missing SOW',
      description: 'Critical documents needed for handover',
      action: 'Fix Now',
      onClick: () => console.log('Fix SOW'),
    },
    {
      title: '2 meetings completed without MOM',
      description: 'Meeting minutes required for approval',
      action: 'Upload Now',
      onClick: () => console.log('Upload MOM'),
    },
  ];

  return (
    <Layout
      title="Sales Dashboard"
      subtitle="Drive projects through execution workflow"
      user={user}
      sidebarItems={sidebarItems}
    >
      {/* Primary Action */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/sales/intake')}
          className="w-full sm:w-auto"
        >
          Start New Intake
        </Button>
      </motion.div>

      {/* Action Required */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-textPrimary mb-4">Action Required</h2>
        <div className="grid gap-4">
          {getActionRequiredProjects().map((project: Project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }}
              className="transition-all duration-200"
            >
              <Card className="border-l-4 border-yellow-500">
                <CardBody>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-textPrimary">{project.name}</h3>
                      <p className="text-sm text-textSecondary">{project.client_name}</p>
                    </div>
                    <StatusBadge variant={getStatusColor(project.status)}>
                      {getStatusLabel(project.status)}
                    </StatusBadge>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-textPrimary mb-2">Next Action:</p>
                    <ul className="text-sm text-textSecondary space-y-1">
                      {project.status === 'HANDOVER_PENDING' && <li>• Complete handover checklist</li>}
                      {project.status === 'AWAITING_APPROVAL' && <li>• Waiting for CTO approval</li>}
                    </ul>
                  </div>
                  
                  <div className="flex space-x-2">
                    {project.status === 'HANDOVER_PENDING' && (
                      <Button variant="primary" size="sm" onClick={() => navigate(`/project/${project.id}/handover`)}>Complete Handover</Button>
                    )}
                    {project.status === 'AWAITING_APPROVAL' && (
                      <Button variant="secondary" size="sm" disabled>Awaiting Approval</Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Status-based Project Sections */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-textPrimary mb-4">Projects by Status</h2>
        
        {['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING', 'AWAITING_APPROVAL'].map((status) => {
          const statusProjects = getProjectsByStatus(status);
          if (statusProjects.length === 0) return null;
          
          return (
            <div key={status} className="mb-6">
              <h3 className="text-lg font-medium text-textPrimary mb-3">{getStatusLabel(status)}</h3>
              <div className="grid gap-3">
                {statusProjects.map((project: Project) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="transition-all duration-200 cursor-pointer"
                  >
                    <Card hover>
                      <CardBody>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-textPrimary">{project.name}</h4>
                            <p className="text-sm text-textSecondary">{project.client_name}</p>
                            <div className="mt-2 text-xs text-textTertiary">
                              <p>Created: {new Date(project.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <StatusBadge variant={getStatusColor(project.status)}>
                            {getStatusLabel(project.status)}
                          </StatusBadge>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <h3 className="text-lg font-medium text-textPrimary mb-4">No projects yet</h3>
          <div className="text-left max-w-md mx-auto mb-6">
            <ol className="space-y-2 text-sm text-textSecondary">
              <li>1. Start Intake</li>
              <li>2. Schedule Meeting</li>
              <li>3. Complete Handover</li>
            </ol>
          </div>
          <Button variant="primary" onClick={() => navigate('/sales/intake')}>
            Start Your First Project
          </Button>
        </motion.div>
      )}

      {/* Insights Panel */}
      <InsightsPanel />
    </Layout>
  );
};

export default SalesDashboard;
