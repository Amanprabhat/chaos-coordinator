import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Button, Card, CardHeader, CardBody, CardFooter, StatusBadge, AlertCard } from '../components/ui';
import InsightsPanel from '../components/layout/InsightsPanel';

interface Project {
  id: number;
  project_name: string;
  client_name: string;
  status: string;
  stage: string;
  assigned_csm: string;
  pm: string;
  meeting_date?: string;
  sow_uploaded: boolean;
  mom_uploaded: boolean;
  handover_completed: boolean;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data
  useEffect(() => {
    const mockProjects: Project[] = [
      {
        id: 1,
        project_name: 'E-commerce Platform',
        client_name: 'Tech Corp',
        status: 'Handover Pending',
        stage: 'Handover Pending',
        assigned_csm: 'Lisa Johnson',
        pm: 'John Smith',
        meeting_date: '2024-01-15',
        sow_uploaded: false,
        mom_uploaded: true,
        handover_completed: false,
      },
      {
        id: 2,
        project_name: 'Mobile App Development',
        client_name: 'StartupXYZ',
        status: 'Meeting Scheduled',
        stage: 'Meeting Scheduled',
        assigned_csm: 'Sarah Chen',
        pm: '',
        meeting_date: '2024-01-18',
        sow_uploaded: true,
        mom_uploaded: false,
        handover_completed: false,
      },
    ];

    const mockMeetings: Meeting[] = [
      {
        id: 1,
        project_name: 'E-commerce Platform',
        meeting_date_time: '2024-01-15 14:00',
        participants: ['John Smith', 'Lisa Johnson', 'Client Rep'],
        completed: true,
      },
      {
        id: 2,
        project_name: 'Mobile App Development',
        meeting_date_time: '2024-01-18 10:00',
        participants: ['Sarah Chen', 'Client Rep'],
        completed: false,
      },
    ];

    setProjects(mockProjects);
    setMeetings(mockMeetings);
  }, []);

  const getActionRequiredProjects = () => {
    return projects.filter(p => 
      p.status === 'Handover Pending' || 
      !p.sow_uploaded || 
      !p.mom_uploaded ||
      (p.meeting_date && !p.handover_completed)
    );
  };

  const getProjectsByStage = (stage: string) => {
    return projects.filter(p => p.stage === stage);
  };

  const upcomingMeetings = meetings.filter(m => !m.completed);
  const completedMeetings = meetings.filter(m => m.completed);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Meeting Scheduled': return 'info';
      case 'Handover Pending': return 'warning';
      case 'Awaiting Approval': return 'purple';
      case 'Approved': return 'success';
      default: return 'neutral';
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
          {getActionRequiredProjects().map((project) => (
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
                      <h3 className="font-semibold text-textPrimary">{project.project_name}</h3>
                      <p className="text-sm text-textSecondary">{project.client_name}</p>
                    </div>
                    <StatusBadge variant={getStatusColor(project.status)}>
                      {project.status}
                    </StatusBadge>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-textPrimary mb-2">Missing Items:</p>
                    <ul className="text-sm text-textSecondary space-y-1">
                      {!project.sow_uploaded && <li>• SOW Document</li>}
                      {!project.mom_uploaded && <li>• Meeting Minutes (MOM)</li>}
                      {project.meeting_date && !project.handover_completed && <li>• Handover Completion</li>}
                    </ul>
                  </div>
                  
                  <div className="flex space-x-2">
                    {!project.sow_uploaded && (
                      <Button variant="secondary" size="sm">Upload SOW</Button>
                    )}
                    {!project.mom_uploaded && (
                      <Button variant="secondary" size="sm">Upload MOM</Button>
                    )}
                    {project.meeting_date && !project.handover_completed && (
                      <Button variant="primary" size="sm">Complete Handover</Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Meetings */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-textPrimary mb-4">Meetings</h2>
        
        {/* Upcoming Meetings */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-textPrimary mb-3">Upcoming Meetings</h3>
          <div className="grid gap-3">
            {upcomingMeetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.01 }}
                className="transition-all duration-200"
              >
                <Card>
                  <CardBody>
                    <h4 className="font-medium text-textPrimary">{meeting.project_name}</h4>
                    <p className="text-sm text-textSecondary">{meeting.meeting_date_time}</p>
                    <p className="text-xs text-textTertiary mt-1">
                      Participants: {meeting.participants.join(', ')}
                    </p>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Completed Meetings */}
        <div>
          <h3 className="text-lg font-medium text-textPrimary mb-3">Completed Meetings</h3>
          <div className="grid gap-3">
            {completedMeetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.01 }}
                className="transition-all duration-200"
              >
                <Card>
                  <CardBody>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-textPrimary">{meeting.project_name}</h4>
                        <p className="text-sm text-textSecondary">{meeting.meeting_date_time}</p>
                      </div>
                      <StatusBadge variant="warning">Awaiting Handover</StatusBadge>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* My Projects */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-textPrimary mb-4">My Projects</h2>
        
        {['POC', 'Meeting Scheduled', 'Handover Pending', 'Awaiting Approval'].map((stage) => {
          const stageProjects = getProjectsByStage(stage);
          if (stageProjects.length === 0) return null;
          
          return (
            <div key={stage} className="mb-6">
              <h3 className="text-lg font-medium text-textPrimary mb-3">{stage}</h3>
              <div className="grid gap-3">
                {stageProjects.map((project) => (
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
                            <h4 className="font-medium text-textPrimary">{project.project_name}</h4>
                            <p className="text-sm text-textSecondary">{project.client_name}</p>
                            <div className="mt-2 text-xs text-textTertiary">
                              <p>CSM: {project.assigned_csm}</p>
                              {project.pm && <p>PM: {project.pm}</p>}
                            </div>
                          </div>
                          <StatusBadge variant={getStatusColor(project.stage)}>
                            {project.stage}
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
