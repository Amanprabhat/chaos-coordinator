export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Sales' | 'CSM' | 'PM' | 'Client';
  manager_id?: number;
  is_active: boolean;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Project {
  id: number;
  name: string;
  client_name: string;
  current_stage_id: number;
  current_stage: string;
  owner_id: number;
  owner_name: string;
  owner_role: string;
  status: 'active' | 'completed' | 'on_hold';
  created_at: string;
  updated_at: string;
  strict_mode?: boolean;
  health_score?: number;
  delay_score?: number;
  accountability_score?: number;
  decision_maturity_score?: number;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  project_id: number;
  milestone_id?: number;
  owner_id: number;
  accountable_id?: number;
  status: 'todo' | 'in_progress' | 'completed' | 'blocked' | 'at_risk' | 'reopened';
  due_date: string;
  estimated_hours?: number;
  actual_hours?: number;
  sla_hours?: number;
  sla_start_time?: string;
  sla_paused?: boolean;
  sla_pause_reason?: string;
  sla_breached?: boolean;
  completion_comment?: string;
  watchers?: number[];
  reopened?: boolean;
  reopen_reason?: string;
  delay_reason?: string;
  delay_category?: 'dependency' | 'client' | 'internal' | 'external' | 'resource' | 'technical' | 'unknown';
  delay_impact_hours?: number;
  delay_notified?: boolean;
  delay_resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  title: string;
  description?: string;
  project_id: number;
  owner_id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: number;
  project_id: number;
  title: string;
  description: string;
  taken_by: number;
  stakeholders: number[];
  decision_date: string;
  impact_area: 'scope' | 'timeline' | 'tech' | 'process' | 'budget' | 'quality';
  related_task_id?: number;
  decision_status: 'active' | 'reversed' | 'superseded' | 'implemented';
  justification?: string;
  alternatives_considered?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  project_id?: number;
  type: 'task_assigned' | 'task_overdue' | 'milestone_completed' | 'risk_escalated' | 'project_stuck' | 'health_alert' | 'handover_pending' | 'stage_transition';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectHealth {
  project_id: number;
  health_score: number;
  health_status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  factors: {
    task_completion: number;
    milestone_completion: number;
    risk_management: number;
    sla_compliance: number;
    change_control: number;
  };
  recommendations: string[];
}

export interface NextAction {
  type: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_time: string;
  action: string;
}

export interface BlockingIssue {
  type: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count?: number;
  impact_hours?: number;
}

export interface KnowledgeAsset {
  id: number;
  project_id: number;
  title: string;
  content: string;
  type: string;
  status: 'draft' | 'review' | 'approved' | 'published';
  approved_by_client: boolean;
  approved_by_internal: boolean;
  client_approval_date?: string;
  internal_approval_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  content: string;
  action_type: 'created' | 'updated' | 'assigned' | 'completed' | 'commented' | 'status_change';
  created_at: string;
}

export interface DashboardData {
  user: User;
  summary: {
    total_projects: number;
    active_projects: number;
    total_tasks: number;
    completed_tasks: number;
    total_users: number;
    active_users: number;
  };
  sections: {
    [key: string]: {
      title: string;
      items: any[];
      actions: { type: string; label: string; icon?: string }[];
    };
  };
  metrics?: any;
  quick_actions: {
    type: string;
    label: string;
    icon: string;
  }[];
}

export interface ProjectDetailData {
  project: Project;
  milestones: Milestone[];
  tasks: Task[];
  health: ProjectHealth;
  next_actions: NextAction[];
  blocking_issues: BlockingIssue[];
  timeline: any[];
  knowledge_assets: KnowledgeAsset[];
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Form types
export interface TaskFormData {
  title: string;
  description?: string;
  owner_id: number;
  accountable_id?: number;
  due_date: string;
  estimated_hours?: number;
  sla_hours?: number;
  milestone_id?: number;
}

export interface ProjectFormData {
  name: string;
  client_name: string;
  owner_id: number;
  template_id?: number;
  strict_mode?: boolean;
}

export interface HandoverFormData {
  project_id: number;
  from_role: string;
  to_role: string;
  notes: string;
  checklist_items: {
    title: string;
    is_mandatory: boolean;
    is_completed: boolean;
  }[];
}

export interface CreateProjectRequest {
  name: string;
  client_name: string;
  owner_id: number;
  template_id?: number;
  strict_mode?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  project_id: number;
  owner_id: number;
  accountable_id?: number;
  due_date?: string;
  estimated_hours?: number;
  sla_hours?: number;
  milestone_id?: number;
}

// Component props types
export interface ActionButtonProps {
  type: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface CardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'textarea' | 'select' | 'date' | 'number';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    required?: boolean;
    minLength?: number;
    pattern?: string;
  };
}

export interface TimelineItemProps {
  title: string;
  description?: string;
  timestamp: string;
  type: string;
  user?: string;
  status?: string;
  icon?: React.ReactNode;
}
