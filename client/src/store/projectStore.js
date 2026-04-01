import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// API base URL - adjust as needed for your environment
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001/api';

/**
 * Project State Store - Central state management for project data
 * Provides reactive state management with API integration
 */

const useProjectStore = create(
  devtools(
    (set, get) => ({
      // State
      currentProject: null,
      projects: [],
      loading: false,
      error: null,
      lastUpdated: null,

      // Actions
      setProject: (project) => {
        console.log('[PROJECT_STORE] Setting current project:', project?.id);
        set(
          {
            currentProject: project,
            lastUpdated: new Date(),
            error: null
          },
          false,
          'setProject'
        );
      },

      setProjects: (projects) => {
        console.log('[PROJECT_STORE] Setting projects list:', projects.length);
        set(
          {
            projects,
            lastUpdated: new Date(),
            error: null
          },
          false,
          'setProjects'
        );
      },

      setLoading: (loading) => {
        set({ loading }, false, 'setLoading');
      },

      setError: (error) => {
        console.error('[PROJECT_STORE] Setting error:', error);
        set({ error, loading: false }, false, 'setError');
      },

      // API Actions
      fetchProject: async (projectId) => {
        const { setLoading, setError, setProject } = get();
        
        try {
          setLoading(true);
          console.log(`[PROJECT_STORE] Fetching project ${projectId}`);
          
          const response = await fetch(`${API_BASE}/projects/${projectId}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
          }
          
          const project = await response.json();
          setProject(project);
          
          console.log(`[PROJECT_STORE] Successfully fetched project ${projectId}`);
          return project;
          
        } catch (error) {
          console.error(`[PROJECT_STORE] Error fetching project ${projectId}:`, error);
          setError(error.message);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      fetchProjects: async (filters = {}) => {
        const { setLoading, setError, setProjects } = get();
        
        try {
          setLoading(true);
          console.log('[PROJECT_STORE] Fetching projects with filters:', filters);
          
          const queryParams = new URLSearchParams(filters).toString();
          const url = `${API_BASE}/projects${queryParams ? `?${queryParams}` : ''}`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
          }
          
          const projects = await response.json();
          setProjects(projects);
          
          console.log(`[PROJECT_STORE] Successfully fetched ${projects.length} projects`);
          return projects;
          
        } catch (error) {
          console.error('[PROJECT_STORE] Error fetching projects:', error);
          setError(error.message);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      refreshProject: async (projectId) => {
        const { fetchProject } = get();
        
        if (!projectId) {
          const { currentProject } = get();
          projectId = currentProject?.id;
        }
        
        if (!projectId) {
          console.warn('[PROJECT_STORE] No project ID available for refresh');
          return null;
        }
        
        return await fetchProject(projectId);
      },

      refreshProjects: async (filters = {}) => {
        const { fetchProjects } = get();
        return await fetchProjects(filters);
      },

      // Status-specific getters
      getStatus: () => {
        const { currentProject } = get();
        return currentProject?.status || null;
      },

      isStatus: (status) => {
        const currentStatus = get().getStatus();
        return currentStatus === status;
      },

      canTransitionTo: (targetStatus) => {
        const currentStatus = get().getStatus();
        
        const validTransitions = {
          'INTAKE_CREATED': ['MEETING_SCHEDULED'],
          'MEETING_SCHEDULED': ['MEETING_COMPLETED'],
          'MEETING_COMPLETED': ['HANDOVER_PENDING'],
          'HANDOVER_PENDING': ['AWAITING_APPROVAL'],
          'AWAITING_APPROVAL': ['APPROVED'],
          'APPROVED': ['ACTIVE'],
          'ACTIVE': []
        };
        
        return validTransitions[currentStatus]?.includes(targetStatus) || false;
      },

      getValidNextStatuses: () => {
        const currentStatus = get().getStatus();
        
        const validTransitions = {
          'INTAKE_CREATED': ['MEETING_SCHEDULED'],
          'MEETING_SCHEDULED': ['MEETING_COMPLETED'],
          'MEETING_COMPLETED': ['HANDOVER_PENDING'],
          'HANDOVER_PENDING': ['AWAITING_APPROVAL'],
          'AWAITING_APPROVAL': ['APPROVED'],
          'APPROVED': ['ACTIVE'],
          'ACTIVE': []
        };
        
        return validTransitions[currentStatus] || [];
      },

      // Action helpers for common operations
      scheduleMeeting: async (projectId, meetingData) => {
        try {
          console.log(`[PROJECT_STORE] Scheduling meeting for project ${projectId}`);
          
          const response = await fetch(`${API_BASE}/meetings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...meetingData,
              project_id: projectId
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to schedule meeting: ${response.status} ${response.statusText}`);
          }
          
          const meeting = await response.json();
          
          // Refresh project to get updated status
          await get().refreshProject(projectId);
          
          console.log(`[PROJECT_STORE] Successfully scheduled meeting for project ${projectId}`);
          return meeting;
          
        } catch (error) {
          console.error(`[PROJECT_STORE] Error scheduling meeting for project ${projectId}:`, error);
          get().setError(error.message);
          throw error;
        }
      },

      completeMeeting: async (meetingId, completionData) => {
        try {
          console.log(`[PROJECT_STORE] Completing meeting ${meetingId}`);
          
          const response = await fetch(`${API_BASE}/meetings/${meetingId}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(completionData)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to complete meeting: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // Refresh project to get updated status
          await get().refreshProject();
          
          console.log(`[PROJECT_STORE] Successfully completed meeting ${meetingId}`);
          return result;
          
        } catch (error) {
          console.error(`[PROJECT_STORE] Error completing meeting ${meetingId}:`, error);
          get().setError(error.message);
          throw error;
        }
      },

      uploadDocument: async (projectId, documentData) => {
        try {
          console.log(`[PROJECT_STORE] Uploading document for project ${projectId}`);
          
          const response = await fetch(`${API_BASE}/handover/documents`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...documentData,
              project_id: projectId
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to upload document: ${response.status} ${response.statusText}`);
          }
          
          const document = await response.json();
          
          // Refresh project to get updated status
          await get().refreshProject(projectId);
          
          console.log(`[PROJECT_STORE] Successfully uploaded document for project ${projectId}`);
          return document;
          
        } catch (error) {
          console.error(`[PROJECT_STORE] Error uploading document for project ${projectId}:`, error);
          get().setError(error.message);
          throw error;
        }
      },

      approveProject: async (projectId, approvalData) => {
        try {
          console.log(`[PROJECT_STORE] Approving project ${projectId}`);
          
          const response = await fetch(`${API_BASE}/projects/${projectId}/approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(approvalData)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to approve project: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // Refresh project to get updated status
          await get().refreshProject(projectId);
          
          console.log(`[PROJECT_STORE] Successfully approved project ${projectId}`);
          return result;
          
        } catch (error) {
          console.error(`[PROJECT_STORE] Error approving project ${projectId}:`, error);
          get().setError(error.message);
          throw error;
        }
      },

      rejectProject: async (projectId, rejectionData) => {
        try {
          console.log(`[PROJECT_STORE] Rejecting project ${projectId}`);
          
          const response = await fetch(`${API_BASE}/projects/${projectId}/reject`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rejectionData)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to reject project: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // Refresh project to get updated status
          await get().refreshProject(projectId);
          
          console.log(`[PROJECT_STORE] Successfully rejected project ${projectId}`);
          return result;
          
        } catch (error) {
          console.error(`[PROJECT_STORE] Error rejecting project ${projectId}:`, error);
          get().setError(error.message);
          throw error;
        }
      },

      // Clear state
      clearProject: () => {
        console.log('[PROJECT_STORE] Clearing current project');
        set(
          {
            currentProject: null,
            error: null
          },
          false,
          'clearProject'
        );
      },

      clearError: () => {
        set({ error: null }, false, 'clearError');
      }
    }),
    {
      name: 'project-store'
    }
  )
);

export { useProjectStore };
