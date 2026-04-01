// API Layer for Chaos Coordinator
// Base URL: http://localhost:3001/api

const API_BASE_URL = 'http://localhost:3001/api';

// Types for API responses
interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_id?: number;
  creator_id?: number;
  due_date?: string;
  completion_comment?: string;
  completed_at?: string;
  project_id: number;
  milestone_id?: number;
  created_at: string;
  updated_at: string;
}

interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  status: string;
  due_date?: string;
  owner_id?: number;
  created_at: string;
  updated_at: string;
  tasks?: Task[];
}

interface Project {
  id: number;
  name: string;
  description?: string;
  client_name?: string;
  status: string;
  stage: string;
  pm_id?: number;
  sales_owner_id?: number;
  csm_id?: number;
  start_date?: string;
  target_date?: string;
  actual_end_date?: string;
  budget_allocated?: number;
  budget_consumed?: number;
  health_score?: number;
  created_at: string;
  updated_at: string;
  milestones?: Milestone[];
  tasks?: Task[];
}

// API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    console.log(`🔗 API Call: ${API_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    console.log(`📊 Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} - ${errorText}`);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ API Response:`, data);
    return data;

  } catch (error) {
    console.error(`🚨 Network Error:`, error);
    throw error;
  }
}

// API Functions
export const api = {
  // Get project by ID
  async getProjectById(id: number): Promise<Project> {
    console.log(`🔍 Fetching project with ID: ${id}`);
    
    // First get all projects and find the one with matching ID
    const projects = await apiCall<Project[]>('/projects');
    const project = projects.find(p => p.id === id);
    
    if (!project) {
      throw new Error(`Project with ID ${id} not found`);
    }
    
    // Get milestones and tasks for this project
    const [milestones, tasks] = await Promise.all([
      this.getMilestones(id),
      this.getTasks(id)
    ]);
    
    // Attach milestones and tasks to project
    project.milestones = milestones.map(milestone => ({
      ...milestone,
      tasks: tasks.filter(task => task.milestone_id === milestone.id)
    }));
    
    project.tasks = tasks.filter(task => !task.milestone_id);
    
    return normalizeProject(project);
  },

  // Get tasks for a project
  async getTasks(projectId: number): Promise<Task[]> {
    console.log(`📋 Fetching tasks for project ID: ${projectId}`);
    const tasks = await apiCall<Task[]>('/tasks');
    return tasks.filter(task => task.project_id === projectId);
  },

  // Get milestones for a project
  async getMilestones(projectId: number): Promise<Milestone[]> {
    console.log(`🎯 Fetching milestones for project ID: ${projectId}`);
    const milestones = await apiCall<Milestone[]>('/milestones');
    return milestones.filter(milestone => milestone.project_id === projectId);
  },

  // Add missing methods for task actions
  async patch(url: string, data: any): Promise<any> {
    console.log(`🔧 PATCH ${url}:`, data);
    return apiCall(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  async put(url: string, data: any): Promise<any> {
    console.log(`🔧 PUT ${url}:`, data);
    return apiCall(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  async post(url: string, data: any): Promise<any> {
    console.log(`🔧 POST ${url}:`, data);
    return apiCall(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },
};

// Data normalization function
function normalizeProject(project: any): Project {
  console.log(`🔧 Normalizing project data:`, project);
  
  return {
    id: project.id,
    name: project.name || project.title || 'Untitled Project',
    description: project.description || '',
    client_name: project.client_name || project.clientName || '',
    status: project.status || 'unknown',
    stage: project.stage || 'unknown',
    pm_id: project.pm_id || project.pmId,
    sales_owner_id: project.sales_owner_id || project.salesOwnerId,
    csm_id: project.csm_id || project.csmId,
    start_date: project.start_date || project.startDate,
    target_date: project.target_date || project.targetDate,
    actual_end_date: project.actual_end_date || project.actualEndDate,
    budget_allocated: project.budget_allocated || project.budgetAllocated,
    budget_consumed: project.budget_consumed || project.budgetConsumed,
    health_score: project.health_score || project.healthScore,
    created_at: project.created_at || project.createdAt || new Date().toISOString(),
    updated_at: project.updated_at || project.updatedAt || new Date().toISOString(),
    milestones: project.milestones || [],
    tasks: project.tasks || [],
  };
}

export type { Project, Milestone, Task, ApiResponse };
