import React, { useState, useEffect } from 'react';
import { api, Project, Milestone, Task } from '../api/api';
import Logo from '../components/common/Logo';

const ProjectDebug: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hardcoded project ID as requested
  const PROJECT_ID = 1;

  useEffect(() => {
    console.log('🚀 ProjectDebug component mounted');
    loadProject();
  }, []);

  const loadProject = async () => {
    try {
      console.log(`📥 Starting to load project ${PROJECT_ID}`);
      setLoading(true);
      setError(null);

      // Fetch project data
      const projectData = await api.getProjectById(PROJECT_ID);
      console.log('📊 Project data received:', projectData);
      
      setProject(projectData);
    } catch (err) {
      console.error('❌ Error loading project:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="mb-6" />
          <h1>Project Debug - Loading...</h1>
          <p>Fetching project data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="mb-6" />
          <h1>Project Debug - Error</h1>
          <p style={{ color: 'red' }}>Error: {error}</p>
          <button onClick={loadProject}>Retry</button>
        </div>
      </div>
    );
  }

  // Render no data state
  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="mb-6" />
          <h1>Project Debug - No Data</h1>
          <p>No project data found.</p>
          <button onClick={loadProject}>Retry</button>
        </div>
      </div>
    );
  }

  // Render project data
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <Logo size="sm" />
            <h1 className="text-2xl font-bold text-gray-900">Project Debug</h1>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1>Project Debug</h1>
      
      {/* Project Information */}
      <div>
        <h2>Project Information</h2>
        <p><strong>ID:</strong> {project.id}</p>
        <p><strong>Name:</strong> {project.name}</p>
        <p><strong>Status:</strong> {project.status}</p>
        <p><strong>Description:</strong> {project.description || 'No description'}</p>
        <p><strong>Client:</strong> {project.client_name || 'No client'}</p>
        <p><strong>Stage:</strong> {project.stage || 'No stage'}</p>
        <p><strong>PM ID:</strong> {project.pm_id || 'No PM'}</p>
        <p><strong>Sales Owner ID:</strong> {project.sales_owner_id || 'No sales owner'}</p>
        <p><strong>CSM ID:</strong> {project.csm_id || 'No CSM'}</p>
        <p><strong>Health Score:</strong> {project.health_score || 'No score'}</p>
        <p><strong>Created:</strong> {new Date(project.created_at).toLocaleString()}</p>
        <p><strong>Updated:</strong> {new Date(project.updated_at).toLocaleString()}</p>
      </div>

      {/* Milestones */}
      <div>
        <h2>Milestones ({project.milestones?.length || 0})</h2>
        {project.milestones && project.milestones.length > 0 ? (
          project.milestones.map((milestone: Milestone) => (
            <div key={milestone.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
              <h3>Milestone: {milestone.name}</h3>
              <p><strong>ID:</strong> {milestone.id}</p>
              <p><strong>Status:</strong> {milestone.status}</p>
              <p><strong>Description:</strong> {milestone.description || 'No description'}</p>
              <p><strong>Due Date:</strong> {milestone.due_date ? new Date(milestone.due_date).toLocaleDateString() : 'No due date'}</p>
              
              {/* Tasks under this milestone */}
              <div>
                <h4>Tasks ({milestone.tasks?.length || 0})</h4>
                {milestone.tasks && milestone.tasks.length > 0 ? (
                  milestone.tasks.map((task: Task) => (
                    <div key={task.id} style={{ border: '1px solid #ddd', margin: '5px', padding: '5px' }}>
                      <p><strong>Task:</strong> {task.title}</p>
                      <p><strong>Status:</strong> {task.status}</p>
                      <p><strong>Priority:</strong> {task.priority}</p>
                      <p><strong>Assignee ID:</strong> {task.assignee_id || 'No assignee'}</p>
                      <p><strong>Creator ID:</strong> {task.creator_id || 'No creator'}</p>
                      <p><strong>Description:</strong> {task.description || 'No description'}</p>
                    </div>
                  ))
                ) : (
                  <p>No tasks for this milestone</p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No milestones found</p>
        )}
      </div>

      {/* Tasks not under milestones */}
      <div>
        <h2>Other Tasks ({project.tasks?.length || 0})</h2>
        {project.tasks && project.tasks.length > 0 ? (
          project.tasks.map((task: Task) => (
            <div key={task.id} style={{ border: '1px solid #ddd', margin: '5px', padding: '5px' }}>
              <p><strong>Task:</strong> {task.title}</p>
              <p><strong>Status:</strong> {task.status}</p>
              <p><strong>Priority:</strong> {task.priority}</p>
              <p><strong>Assignee ID:</strong> {task.assignee_id || 'No assignee'}</p>
              <p><strong>Creator ID:</strong> {task.creator_id || 'No creator'}</p>
              <p><strong>Description:</strong> {task.description || 'No description'}</p>
            </div>
          ))
        ) : (
          <p>No other tasks found</p>
        )}
      </div>

      {/* Debug Controls */}
      <div>
        <h2>Debug Controls</h2>
        <button onClick={loadProject}>Reload Data</button>
        <button onClick={() => console.log('Current project state:', project)}>Log Project State</button>
      </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDebug;
