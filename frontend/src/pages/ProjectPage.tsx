import React, { useState, useEffect, useContext } from 'react';
import { api, Project, Milestone, Task } from '../api/api';
import { AppProvider, useAppContext } from '../contexts/AppContext';
import Logo from '../components/common/Logo';

// API functions for task actions
const completeTask = async (taskId: number): Promise<void> => {
  try {
    await api.patch(`/tasks/${taskId}/complete`, {});
  } catch (error) {
    console.error('Failed to complete task:', error);
    throw error;
  }
};

const assignTask = async (taskId: number, assigneeId: number): Promise<void> => {
  try {
    await api.post(`/tasks/${taskId}/assign`, { owner_id: assigneeId, assigned_by: 1 });
  } catch (error) {
    console.error('Failed to assign task:', error);
    throw error;
  }
};

const updateTask = async (taskId: number, updates: Partial<Task>): Promise<void> => {
  try {
    await api.put(`/tasks/${taskId}`, updates);
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
};

const ProjectPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { project, loading, error, actionLoading, actionError, resolvedTasks, highlightedTaskId, editingTask, showFeedback, microFeedback, projectStabilized, stageTransition } = state;
  
  // Local state for UI-specific features
  const [healthScore, setHealthScore] = useState<number>(0);
  const [previousHealthScore, setPreviousHealthScore] = useState<number>(0);
  const [animatingScore, setAnimatingScore] = useState<boolean>(false);
  const [healthBreakdown, setHealthBreakdown] = useState<{ escalations: number, overdue: number, blocked: number, slaBreaches: number }>({ escalations: 0, overdue: 0, blocked: 0, slaBreaches: 0 });
  const [healthTrend, setHealthTrend] = useState<{ trend: 'up' | 'down' | 'stable', change: number }>({ trend: 'stable', change: 0 });
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedTaskForAssign, setSelectedTaskForAssign] = useState<Task | null>(null);

  const PROJECT_ID = 1;

  // Mock user data for demonstration
  const mockUsers = [
    { id: 3, name: 'John PM' },
    { id: 2, name: 'Sarah Sales' },
    { id: 4, name: 'Lisa CSM' },
  ];

  useEffect(() => {
    console.log('🚀 ProjectPage component mounted');
    loadProject();
  }, []);

  const loadProject = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      console.log('🚀 API call: Load project', PROJECT_ID);
      const data = await api.getProjectById(PROJECT_ID);
      dispatch({ type: 'SET_PROJECT', payload: data });

      // Initialize health score and breakdown
      const initialHealth = calculateHealthScore(data);
      setHealthScore(initialHealth.score);
      setPreviousHealthScore(initialHealth.score);
      setHealthBreakdown(initialHealth.breakdown);

      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      console.error('Failed to load project:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load project data. Please try again.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Helper functions for UI
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': case 'active': return 'bg-blue-100 text-blue-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'pending': case 'planning': return 'bg-gray-100 text-gray-800';
      case 'todo': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUserName = (userId: number) => {
    const user = mockUsers.find(u => u.id === userId);
    return user ? user.name : `User ${userId}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const isAtRisk = (dueDate: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 2 && daysUntilDue > 0;
  };

  const getMilestoneUrgency = (milestone: Milestone) => {
    if (milestone.status?.toLowerCase() === 'blocked') return { color: 'bg-red-100 text-red-800', text: 'Blocked' };
    if (isOverdue(milestone.due_date || '')) return { color: 'bg-red-100 text-red-800', text: 'Overdue' };
    if (isAtRisk(milestone.due_date || '')) return { color: 'bg-yellow-100 text-yellow-800', text: 'At Risk' };
    return { color: getStatusColor(milestone.status), text: milestone.status };
  };

  // Priority scoring system - FIXED LOGIC
  const getTaskPriorityInfo = (task: Task): { level: 'HIGH' | 'MEDIUM' | 'LOW', score: number, reason: string } => {
    let score = 0;
    let reason = '';

    // CRITICAL RULES - No contradictions
    const taskEscalated = isEscalated(task);
    const taskOverdue = isOverdue(task.due_date || '');
    const daysOverdue = taskOverdue ? Math.ceil((new Date().getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isBlocked = task.status?.toLowerCase() === 'blocked';
    const taskAtRisk = isAtRisk(task.due_date || '');

    // Rule 1: Escalated → ALWAYS HIGH
    if (taskEscalated) {
      score = 100;
      reason = 'Escalated to management';
    }
    // Rule 2: Blocked → HIGH
    else if (isBlocked) {
      score = 95;
      reason = 'Blocking other tasks';
    }
    // Rule 3: SLA breached → HIGH (overdue < 7 days)
    else if (taskOverdue && daysOverdue <= 7) {
      score = 90;
      reason = `SLA breach - ${daysOverdue} days overdue`;
    }
    // Rule 4: Overdue > 7 days → MEDIUM
    else if (taskOverdue && daysOverdue > 7) {
      score = 60;
      if (daysOverdue > 30) {
        reason = 'Long pending - needs attention';
      } else {
        reason = `Overdue - ${daysOverdue} days`;
      }
    }
    // Rule 5: Upcoming risk → MEDIUM
    else if (taskAtRisk) {
      score = 50;
      reason = 'Due in next 2 days';
    }
    // Rule 6: No owner → MEDIUM
    else if (!task.assignee_id) {
      score = 40;
      reason = 'No owner assigned';
    }
    // Rule 7: Everything else → LOW
    else {
      score = 20;
      reason = 'Normal task';
    }

    // Determine level based on score
    let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (score >= 80) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';

    return { level, score, reason };
  };

  // Calculate dynamic health score - FIXED LOGIC
  const calculateHealthScore = (projectData: Project | null): { score: number, breakdown: { escalations: number, overdue: number, blocked: number, slaBreaches: number } } => {
    if (!projectData) return { score: 0, breakdown: { escalations: 0, overdue: 0, blocked: 0, slaBreaches: 0 } };
    
    let escalations = 0;
    let overdue = 0;
    let blocked = 0;
    let slaBreaches = 0;
    
    // Collect all tasks
    const allTasks: Task[] = [];
    projectData.milestones?.forEach(milestone => {
      if (milestone.tasks) allTasks.push(...milestone.tasks);
    });
    if (projectData.tasks) allTasks.push(...projectData.tasks);
    
    // Filter active tasks (not completed)
    const activeTasks = allTasks.filter(task => task.status?.toLowerCase() !== 'completed');
    
    // Count issues accurately
    activeTasks.forEach(task => {
      const taskEscalated = isEscalated(task);
      const taskOverdue = isOverdue(task.due_date || '');
      const isBlocked = task.status?.toLowerCase() === 'blocked';
      const daysOverdue = taskOverdue ? Math.ceil((new Date().getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      if (taskEscalated) {
        escalations++;
      }
      if (taskOverdue) {
        overdue++;
        if (daysOverdue <= 7) {
          slaBreaches++; // SLA breach is overdue < 7 days
        }
      }
      if (isBlocked) {
        blocked++;
      }
    });
    
    // FIXED SCORING MODEL: Start from 100
    let score = 100;
    score -= (escalations * 30);  // Escalation → -30
    score -= (overdue * 20);     // Overdue task → -20
    score -= (blocked * 25);     // Blocked → -25
    score -= (slaBreaches * 25); // SLA breach → -25
    
    return { 
      score: Math.max(0, Math.min(100, score)), 
      breakdown: { escalations, overdue, blocked, slaBreaches } 
    };
  };

  // Update health score with animation
  const updateHealthScore = (newScore: number) => {
    setPreviousHealthScore(healthScore);
    setHealthScore(newScore);
    setAnimatingScore(true);
    setTimeout(() => setAnimatingScore(false), 1000);
  };
  const getTaskImpact = (task: Task): string => {
    const taskEscalated = isEscalated(task);
    const taskOverdue = isOverdue(task.due_date || '');
    const isBlocked = task.status?.toLowerCase() === 'blocked';
    const daysOverdue = taskOverdue ? Math.ceil((new Date().getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    if (taskEscalated) {
      return 'Critical - management attention required';
    } else if (isBlocked) {
      return 'Blocking project completion';
    } else if (taskOverdue && daysOverdue <= 7) {
      return 'Delaying next milestone';
    } else if (taskOverdue && daysOverdue > 30) {
      return 'Risking project timeline';
    } else if (taskOverdue) {
      return 'Affecting project schedule';
    } else if (!task.assignee_id) {
      return 'Unclear responsibility';
    } else {
      return 'Standard task completion';
    }
  };

  // Get system confidence level
  const getSystemConfidence = (): { level: 'LOW' | 'MEDIUM' | 'HIGH', color: string, description: string } => {
    if (healthBreakdown.escalations > 0) {
      return { level: 'LOW', color: 'text-red-600', description: 'Escalations present' };
    } else if (healthBreakdown.overdue > 0 || healthBreakdown.blocked > 0) {
      return { level: 'MEDIUM', color: 'text-yellow-600', description: 'Only overdue/blocked issues' };
    } else {
      return { level: 'HIGH', color: 'text-green-600', description: 'No issues' };
    }
  };

  // Get health score interpretation
  const getHealthInterpretation = (score: number): { label: string, color: string } => {
    if (score <= 40) return { label: 'Critical', color: 'text-red-600' };
    if (score <= 70) return { label: 'At Risk', color: 'text-yellow-600' };
    return { label: 'Stable', color: 'text-green-600' };
  };

  // Get time intelligence for tasks - REALISTIC DATA
  const getTimeIntelligence = (task: Task): { overdueDays: number, escalatedDays: number, delayedBy: string, displayText: string } => {
    const now = new Date();
    const overdueDays = task.due_date && new Date(task.due_date) < now 
      ? Math.ceil((now.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Mock escalation time (in real app, this would come from backend)
    const escalatedDays = isEscalated(task) ? Math.floor(Math.random() * 5) + 1 : 0;
    
    const delayedBy = task.assignee_id ? getUserName(task.assignee_id) : 'Unassigned';
    
    // Create realistic display text
    let displayText = '';
    if (overdueDays > 0) {
      if (overdueDays > 30) {
        displayText = `Overdue for 30+ days`;
      } else {
        displayText = `Overdue for ${overdueDays} days`;
      }
    }
    if (escalatedDays > 0) {
      displayText += displayText ? ` • Escalated ${escalatedDays} days ago` : `Escalated ${escalatedDays} days ago`;
    }
    if (delayedBy !== 'Unassigned') {
      displayText += displayText ? ` • Delayed by: ${delayedBy}` : `Delayed by: ${delayedBy}`;
    }
    
    return { overdueDays, escalatedDays, delayedBy, displayText };
  };

  // Get realistic trend indicator
  const getHealthTrend = (): { trend: 'up' | 'down' | 'stable', change: number } => {
    // Realistic trend calculation based on actual changes
    if (previousHealthScore === 0 || previousHealthScore === healthScore) {
      return { trend: 'stable', change: 0 };
    }
    
    const change = healthScore - previousHealthScore;
    return {
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      change: Math.abs(change)
    };
  };
  const getBusinessImpact = (): string => {
    if (healthBreakdown.escalations > 0) return 'Project delivery delayed';
    if (healthBreakdown.blocked > 0) return 'Client onboarding blocked';
    if (healthBreakdown.overdue > 0) return 'Milestone timeline impacted';
    return 'On track for delivery';
  };

  const getPriorityColor = (level: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (level) {
      case 'HIGH': return 'bg-red-50 border-red-500 text-red-800';
      case 'MEDIUM': return 'bg-orange-50 border-orange-500 text-orange-800';
      case 'LOW': return 'bg-blue-50 border-blue-500 text-blue-800';
      default: return 'bg-gray-50 border-gray-500 text-gray-800';
    }
  };

  const getTaskPriorityStyles = (task: Task) => {
    const priority = getTaskPriorityInfo(task);
    if (task.status?.toLowerCase() === 'blocked') return 'border-red-500 bg-red-50';
    if (isOverdue(task.due_date || '') && task.due_date) {
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue <= 7 ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50';
    }
    return 'border-gray-200';
  };

  // Check for escalation (overdue > 48 hours)
  const isEscalated = (task: Task) => {
    if (!task.due_date) return false;
    const daysOverdue = Math.ceil((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 2;
  };

  // Calculate action panel data
  const getActionPanelData = () => {
    if (!project) return { 
      focusActions: [] as any[],
      immediateAttention: [] as any[],
      otherIssues: [] as any[],
      alerts: [] as any[],
      blockers: [] as any[],
      upcomingRisks: [] as any[],
      allOnTrack: false,
      nextMilestone: null as any
    };

    const focusActions: any[] = [];
    const immediateAttention: any[] = [];
    const otherIssues: any[] = [];
    const alerts: any[] = [];
    const blockers: any[] = [];
    const upcomingRisks: any[] = [];

    const allTasks: Task[] = [];

    // Collect all tasks
    project.milestones?.forEach(milestone => {
      if (milestone.status?.toLowerCase() === 'blocked') {
        blockers.push({ type: 'milestone', name: milestone.name, id: milestone.id });
      }
      if (milestone.tasks) allTasks.push(...milestone.tasks);
    });

    if (project.tasks) allTasks.push(...project.tasks);

    // Filter out completed tasks
    const activeTasks = allTasks.filter(task => task.status?.toLowerCase() !== 'completed');

    // Process active tasks for prioritization
    const prioritizedTasks = activeTasks.map(task => ({
      task,
      priority: getTaskPriorityInfo(task),
      isEscalated: isEscalated(task),
      isOverdue: isOverdue(task.due_date || ''),
      isBlocked: task.status?.toLowerCase() === 'blocked'
    }));

    // CRITICAL: Check for any real issues (no false positives)
    const hasEscalated = prioritizedTasks.some(item => item.isEscalated);
    const hasOverdue = prioritizedTasks.some(item => item.isOverdue);
    const hasBlocked = prioritizedTasks.some(item => item.isBlocked);
    const hasSLABreach = prioritizedTasks.some(item => item.priority.level === 'HIGH' && item.isOverdue);
    
    const hasRealIssues = hasEscalated || hasOverdue || hasBlocked || hasSLABreach;

    // FIXED PRIORITIZATION LOGIC
    // Priority Order: 1. Escalated, 2. Overdue (recent first), 3. Blocked, 4. SLA breached
    const sortedByPriority = [...prioritizedTasks].sort((a, b) => {
      // 1. Escalated tasks first
      if (a.isEscalated && !b.isEscalated) return -1;
      if (!a.isEscalated && b.isEscalated) return 1;
      
      // 2. Overdue tasks by recency (most recent overdue first)
      if (a.isOverdue && b.isOverdue) {
        const aDaysOverdue = Math.ceil((new Date().getTime() - new Date(a.task.due_date!).getTime()) / (1000 * 60 * 60 * 24));
        const bDaysOverdue = Math.ceil((new Date().getTime() - new Date(b.task.due_date!).getTime()) / (1000 * 60 * 60 * 24));
        return aDaysOverdue - bDaysOverdue; // Less overdue = more urgent (recent)
      }
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      
      // 3. Blocked tasks
      if (a.isBlocked && !b.isBlocked) return -1;
      if (!a.isBlocked && b.isBlocked) return 1;
      
      // 4. SLA breached tasks
      if (a.priority.level === 'HIGH' && b.priority.level !== 'HIGH') return -1;
      if (a.priority.level !== 'HIGH' && b.priority.level === 'HIGH') return 1;
      
      // 5. By priority score
      return b.priority.score - a.priority.score;
    });

    // Focus Mode - Top 3 actionable tasks (NO FALSE POSITIVES)
    const topActionableTasks = sortedByPriority.slice(0, 3);

    topActionableTasks.forEach((item, index) => {
      const { task, priority, isEscalated, isOverdue, isBlocked } = item;
      
      let issueType = '';
      let reason = '';
      
      // Determine issue type and reason
      if (isEscalated) {
        issueType = 'Escalated';
        reason = 'Needs immediate attention';
      } else if (isOverdue) {
        const daysOverdue = Math.ceil((new Date().getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 30) {
          issueType = 'Long Pending';
          reason = 'Pending for long duration';
        } else {
          issueType = 'Overdue';
          reason = 'Needs immediate attention';
        }
      } else if (isBlocked) {
        issueType = 'Blocked';
        reason = 'Waiting on dependencies';
      } else if (priority.level === 'HIGH') {
        issueType = 'SLA Breach';
        reason = 'Critical deadline missed';
      }
      
      focusActions.push({
        task: task,
        priority: priority.level,
        reason: reason,
        issueType: issueType,
        impact: getTaskImpact(task),
        rank: index + 1, // Add ranking
        score: priority.score,
        isEscalated,
        isOverdue,
        isBlocked
      });
    });

    // Immediate Attention - Remaining HIGH priority tasks
    const remainingHighPriority = sortedByPriority.filter(item => 
      item.priority.level === 'HIGH' && 
      !topActionableTasks.some(focus => focus.task.id === item.task.id)
    ).slice(0, 5);

    remainingHighPriority.forEach(item => {
      const { task, priority } = item;
      immediateAttention.push({
        task: task,
        priority: priority.level,
        reason: priority.reason,
        score: priority.score
      });
    });

    // Other Issues - MEDIUM priority tasks
    const mediumPriorityTasks = prioritizedTasks.filter(item => 
      item.priority.level === 'MEDIUM'
    ).slice(0, 5);

    mediumPriorityTasks.forEach(item => {
      const { task, priority } = item;
      otherIssues.push({
        task: task,
        priority: priority.level,
        reason: priority.reason,
        score: priority.score
      });
    });

    // Generate alerts only for NEW/UNSEEN risks (remove redundancy)
    const newRisks: any[] = [];
    const seenTaskIds = new Set([...focusActions.map(a => a.task.id), ...immediateAttention.map(a => a.task.id), ...otherIssues.map(a => a.task.id)]);
    
    // Only include tasks not already shown in priority sections
    prioritizedTasks.forEach(item => {
      if (!seenTaskIds.has(item.task.id) && (item.isOverdue || item.isBlocked)) {
        newRisks.push({
          name: item.task.title,
          id: item.task.id,
          priority: item.priority.level,
          reason: item.priority.reason,
          isNew: true // Mark as new/unseen
        });
      }
    });

    // Calculate remaining issues breakdown - UNIQUE ISSUE LOGIC
    const remainingIssues = {
      total: 0,
      escalated: 0,
      overdue: 0,
      blocked: 0,
      combined: [] as string[] // For combined issue types
    };
    
    // Calculate unique unresolved issues (no double counting)
    const uniqueIssues = new Map<number, { escalated: boolean, overdue: boolean, blocked: boolean }>();
    prioritizedTasks.forEach(item => {
      if (item.isEscalated || item.isOverdue || item.isBlocked) {
        const existing = uniqueIssues.get(item.task.id) || { escalated: false, overdue: false, blocked: false };
        uniqueIssues.set(item.task.id, {
          escalated: existing.escalated || item.isEscalated,
          overdue: existing.overdue || item.isOverdue,
          blocked: existing.blocked || item.isBlocked
        });
      }
    });
    
    remainingIssues.total = uniqueIssues.size;
    
    // Count each type for display
    uniqueIssues.forEach((issues, taskId) => {
      if (issues.escalated) remainingIssues.escalated++;
      if (issues.overdue) remainingIssues.overdue++;
      if (issues.blocked) remainingIssues.blocked++;
    });
    
    // Create combined issue types for display
    uniqueIssues.forEach((issues, taskId) => {
      const task = prioritizedTasks.find(item => item.task.id === taskId)?.task;
      if (task) {
        const types = [];
        if (issues.escalated && issues.overdue) types.push('Escalated (Overdue)');
        else if (issues.escalated) types.push('Escalated');
        else if (issues.overdue) types.push('Overdue');
        else if (issues.blocked) types.push('Blocked');
        remainingIssues.combined.push(`${types.join(' & ')} task: ${task.title.substring(0, 30)}${task.title.length > 30 ? '...' : ''}`);
      }
    });

    // Generate upcoming risks (tasks due in next 48 hours)
    activeTasks.forEach(task => {
      if (task.due_date && task.status?.toLowerCase() !== 'completed') {
        const due = new Date(task.due_date);
        const now = new Date();
        const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilDue > 0 && hoursUntilDue <= 48) {
          upcomingRisks.push({
            name: task.title,
            id: task.id,
            hoursUntilDue: Math.round(hoursUntilDue),
            dueDate: task.due_date
          });
        }
      }
    });

    // Sort upcoming risks by urgency
    upcomingRisks.sort((a, b) => a.hoursUntilDue - b.hoursUntilDue);

    // STRICT EMPTY STATE: Only show "All critical tasks resolved" if NO real issues exist
    const allOnTrack = !hasRealIssues;

    // Find next milestone
    const nextMilestone = project.milestones?.find(m => m.status?.toLowerCase() !== 'completed');

    return { focusActions, immediateAttention, otherIssues, newRisks, blockers, upcomingRisks, allOnTrack, nextMilestone, remainingIssues };
  };

  const actionPanelData = getActionPanelData();

  // Handle stage transition
  const handleStageTransition = () => {
    console.log('🚀 Moving to next stage');
    dispatch({ type: 'SET_STAGE_TRANSITION', payload: false });
    // In real app, this would call lifecycle API
    dispatch({ type: 'SET_SHOW_FEEDBACK', payload: 'Moving to next stage...' });
    setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 3000);
  };

  // Action handlers with API integration and global state
  const handleActionClick = (action: any) => {
    console.log('🎯 Action clicked:', action);
    dispatch({ type: 'HIGHLIGHT_TASK', payload: action.task.id });
    setTimeout(() => dispatch({ type: 'HIGHLIGHT_TASK', payload: null }), 3000);
    
    // Scroll to task
    const element = document.getElementById(`task-${action.task.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

const handleAlertClick = (alert: any) => {
  console.log('🚨 Alert clicked:', alert);
  dispatch({ type: 'HIGHLIGHT_TASK', payload: alert.id });
  setTimeout(() => dispatch({ type: 'HIGHLIGHT_TASK', payload: null }), 3000);
  
  // Scroll to task
  const element = document.getElementById(`task-${alert.id}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const handleTaskAction = async (task: Task, action: string) => {
  console.log(`🔧 Task ${action}:`, task);
  
  try {
    dispatch({ type: 'SET_ACTION_LOADING', payload: true });
    dispatch({ type: 'SET_ACTION_ERROR', payload: null });
    
    switch (action) {
      case 'complete':
        console.log('🚀 API call: Complete task', task.id);
        await completeTask(task.id);
        
        // Update global state
        dispatch({ type: 'MARK_TASK_RESOLVED', payload: task.id });
        
        // Update health score
        const newHealth = calculateHealthScore(project);
        updateHealthScore(newHealth.score);
        setHealthBreakdown(newHealth.breakdown);
        
        // Update trend
        const trend = getHealthTrend();
        setHealthTrend(trend);
        
        // Enable stage transition if ready
        if (newHealth.breakdown.escalations === 0 && newHealth.breakdown.overdue === 0 && newHealth.breakdown.blocked === 0) {
          dispatch({ type: 'SET_STAGE_TRANSITION', payload: true });
        }
        
        // Micro-feedback
        if (isEscalated(task)) {
          dispatch({ type: 'SET_MICRO_FEEDBACK', payload: 'Escalation cleared' });
          setTimeout(() => dispatch({ type: 'SET_MICRO_FEEDBACK', payload: '' }), 2000);
        }
        
        // Check remaining issues
        const remainingCount = (actionPanelData.remainingIssues?.total || 0) - 1;
        if (remainingCount === 1) {
          dispatch({ type: 'SET_MICRO_FEEDBACK', payload: '1 issue left → Almost stable' });
          setTimeout(() => dispatch({ type: 'SET_MICRO_FEEDBACK', payload: '' }), 3000);
        }
        
        // Success feedback
        let feedbackMessage = 'Task completed ✅';
        if (isEscalated(task)) feedbackMessage += ' - 1 escalation cleared';
        if (isOverdue(task.due_date || '')) feedbackMessage += ' - overdue task handled';
        if (task.status?.toLowerCase() === 'blocked') feedbackMessage += ' - blockage removed';
        feedbackMessage += ' - Project risk reduced';
        
        dispatch({ type: 'SET_SHOW_FEEDBACK', payload: feedbackMessage });
        setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 3000);
        
        // Check if all issues resolved for final state
        if (newHealth.breakdown.escalations === 0 && newHealth.breakdown.overdue === 0 && newHealth.breakdown.blocked === 0) {
          dispatch({ type: 'SET_PROJECT_STABILIZED', payload: true });
          setTimeout(() => {
            dispatch({ type: 'SET_SHOW_FEEDBACK', payload: 'Project Stabilized ✅ - Ready to move forward' });
            setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 5000);
          }, 1000);
        }
        
        // Refresh project data to ensure consistency
        setTimeout(() => {
          loadProject();
          // Auto-scroll to next priority item
          setTimeout(() => {
            const nextAction = actionPanelData.focusActions[0];
            if (nextAction && nextAction.task.id !== task.id) {
              handleActionClick(nextAction);
            }
          }, 200);
        }, 100);
        break;
        
      case 'assign':
        console.log('🎯 Show assign modal for task:', task.id);
        setSelectedTaskForAssign(task);
        setShowAssignModal(true);
        break;
        
      case 'edit':
        console.log('🎯 Enable editing for task:', task.id);
        // Set editing task ID in global state
        dispatch({ type: 'SET_EDITING_TASK', payload: task.id });
        break;
    }
  } catch (error) {
    console.error('❌ Task action failed:', error);
    dispatch({ type: 'SET_ACTION_ERROR', payload: `Failed to ${action} task: ${error}` });
    setTimeout(() => dispatch({ type: 'CLEAR_FEEDBACK' }), 5000);
  } finally {
    dispatch({ type: 'SET_ACTION_LOADING', payload: false });
    console.log('🚀 Moving to next stage');
    dispatch({ type: 'SET_STAGE_TRANSITION', payload: false });
    // In real app, this would call lifecycle API
    dispatch({ type: 'SET_SHOW_FEEDBACK', payload: 'Moving to next stage...' });
    setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 3000);
  }
};

  const handleTaskUpdate = async (taskId: number, updates: any) => {
    console.log('📝 Updating task:', taskId, updates);
    
    try {
      dispatch({ type: 'SET_ACTION_LOADING', payload: true });
      dispatch({ type: 'SET_ACTION_ERROR', payload: null });
      
      console.log('🚀 API call: Update task', taskId, updates);
      await updateTask(taskId, updates);
      
      // Show success feedback immediately
      dispatch({ type: 'SET_SHOW_FEEDBACK', payload: 'Task updated successfully' });
      setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 3000);
      
      // Exit editing mode immediately
      dispatch({ type: 'SET_EDITING_TASK', payload: null });
      
      // If task was marked as complete, handle completion logic
      if (updates.status === 'completed') {
        dispatch({ type: 'MARK_TASK_RESOLVED', payload: taskId });
        
        // Calculate new health score
        const newHealth = calculateHealthScore(project);
        updateHealthScore(newHealth.score);
        setHealthBreakdown(newHealth.breakdown);
        
        // Update trend
        const trend = getHealthTrend();
        setHealthTrend(trend);
        
        // Enable stage transition if ready
        if (newHealth.breakdown.escalations === 0 && newHealth.breakdown.overdue === 0 && newHealth.breakdown.blocked === 0) {
          dispatch({ type: 'SET_STAGE_TRANSITION', payload: true });
        }
        
        // Micro-feedback
        dispatch({ type: 'SET_MICRO_FEEDBACK', payload: 'Task completed' });
        setTimeout(() => dispatch({ type: 'SET_MICRO_FEEDBACK', payload: '' }), 2000);
        
        // Check remaining issues
        const remainingCount = (actionPanelData.remainingIssues?.total || 0) - 1;
        if (remainingCount === 1) {
          dispatch({ type: 'SET_MICRO_FEEDBACK', payload: '1 issue left → Almost stable' });
          setTimeout(() => dispatch({ type: 'SET_MICRO_FEEDBACK', payload: '' }), 3000);
        }
        
        // Check if all issues resolved for final state
        if (newHealth.breakdown.escalations === 0 && newHealth.breakdown.overdue === 0 && newHealth.breakdown.blocked === 0) {
          dispatch({ type: 'SET_PROJECT_STABILIZED', payload: true });
          setTimeout(() => {
            dispatch({ type: 'SET_SHOW_FEEDBACK', payload: 'Project Stabilized ✅ - Ready to move forward' });
            setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 5000);
          }, 1000);
        }
        
        dispatch({ type: 'SET_SHOW_FEEDBACK', payload: `Task resolved ✅ - Project risk reduced` });
        setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 3000);
      }
      
      // Refresh project data immediately to show changes
      setTimeout(() => loadProject(), 100);
      
    } catch (error) {
      console.error('❌ Task update failed:', error);
      dispatch({ type: 'SET_ACTION_ERROR', payload: `Failed to update task: ${error}` });
      setTimeout(() => dispatch({ type: 'CLEAR_FEEDBACK' }), 5000);
    } finally {
      dispatch({ type: 'SET_ACTION_LOADING', payload: false });
    }
  };

  const handleAssignTask = async (userId: number) => {
    if (!selectedTaskForAssign) return;
    
    try {
      dispatch({ type: 'SET_ACTION_LOADING', payload: true });
      console.log('🚀 API call: Assign task', selectedTaskForAssign.id, 'to user:', userId);
      console.log('🔍 Task details:', selectedTaskForAssign);
      console.log('🔍 Selected user ID:', userId);
      
      const result = await assignTask(selectedTaskForAssign.id, userId);
      console.log('✅ Assign result:', result);
      
      dispatch({ type: 'SET_SHOW_FEEDBACK', payload: 'Task assigned successfully' });
      setTimeout(() => dispatch({ type: 'SET_SHOW_FEEDBACK', payload: '' }), 3000);
      
      // Close modal immediately
      setShowAssignModal(false);
      setSelectedTaskForAssign(null);
      
      // Refresh project data to show the change
      console.log('🔄 Refreshing project data...');
      setTimeout(() => loadProject(), 100);
      
    } catch (error) {
      console.error('❌ Assign task failed:', error);
      dispatch({ type: 'SET_ACTION_ERROR', payload: `Failed to assign task: ${error}` });
      setTimeout(() => dispatch({ type: 'CLEAR_FEEDBACK' }), 5000);
    } finally {
      dispatch({ type: 'SET_ACTION_LOADING', payload: false });
    }
  };

  const handleCancelEdit = (taskId: number) => {
    console.log('🎯 Cancel editing for task:', taskId);
    // Clear editing state
    dispatch({ type: 'SET_EDITING_TASK', payload: null });
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="mb-6" />
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project data...</p>
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 text-lg font-semibold mb-2">Error Loading Project</h2>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" className="mb-6" />
          <h2 className="text-gray-800 text-lg font-semibold">No Project Data</h2>
          <p className="text-gray-600 mt-2">Unable to load project information</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="sm" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-gray-600">Client: {project.client_name || 'No client'}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.stage)}`}>
                    {project.stage || 'Unknown Stage'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getHealthColor(project.health_score || 0)}`}>
                {project.health_score || 0}%
              </div>
              <div className="text-sm text-gray-600">Health Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          
          {/* LEFT SIDEBAR (20%) */}
          <div className="w-1/5">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Project Team</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">PM:</span>
                  <span className="ml-2 font-medium">{getUserName(project.pm_id || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sales:</span>
                  <span className="ml-2 font-medium">{getUserName(project.sales_owner_id || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500">CSM:</span>
                  <span className="ml-2 font-medium">{getUserName(project.csm_id || 0)}</span>
                </div>
                {project.target_date && (
                  <div>
                    <span className="text-gray-500">Target:</span>
                    <span className="ml-2">{formatDate(project.target_date)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CENTER CONTENT (60%) */}
          <div className="flex-1">
            <div className="space-y-6">
              
              {/* Milestones */}
              {project.milestones && project.milestones.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Milestones</h2>
                  <div className="space-y-4">
                    {project.milestones.map((milestone: Milestone) => {
                      const urgency = getMilestoneUrgency(milestone);
                      return (
                        <div key={milestone.id} className="bg-white rounded-lg shadow p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900">{milestone.name}</h3>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${urgency.color}`}>
                                {urgency.text}
                              </span>
                              {milestone.due_date && (
                                <span className="text-sm text-gray-500">
                                  Due: {formatDate(milestone.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Tasks in milestone */}
                          <div className="space-y-2">
                            {milestone.tasks && milestone.tasks.length > 0 ? (
                              milestone.tasks.filter(task => task.status !== 'completed').map((task: Task) => (
                                <TaskComponent 
                                  key={task.id} 
                                  task={task} 
                                  isHighlighted={highlightedTaskId === task.id}
                                  onAction={handleTaskAction}
                                  onUpdate={handleTaskUpdate}
                                  onCancelEdit={handleCancelEdit}
                                  isEditing={editingTask === task.id}
                                  getPriorityStyles={getTaskPriorityStyles}
                                  getStatusColor={getStatusColor}
                                  getUserName={getUserName}
                                  formatDate={formatDate}
                                />
                              ))
                            ) : (
                              <p className="text-gray-500 text-sm">No tasks yet</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Standalone Tasks */}
              {project.tasks && project.tasks.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Other Tasks</h2>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="space-y-2">
                      {project.tasks.filter(task => task.status !== 'completed').map((task: Task) => (
                        <TaskComponent 
                          key={task.id} 
                          task={task} 
                          isHighlighted={highlightedTaskId === task.id}
                          onAction={handleTaskAction}
                          onUpdate={handleTaskUpdate}
                          onCancelEdit={handleCancelEdit}
                          isEditing={editingTask === task.id}
                          getPriorityStyles={getTaskPriorityStyles}
                          getStatusColor={getStatusColor}
                          getUserName={getUserName}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {(() => {
                const allTasks: Task[] = [];
                project.milestones?.forEach(milestone => {
                  if (milestone.tasks) allTasks.push(...milestone.tasks);
                });
                if (project.tasks) allTasks.push(...project.tasks);
                
                const completedTasks = allTasks.filter(task => task.status === 'completed');
                
                return completedTasks.length > 0 ? (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed Tasks</h2>
                    <div className="bg-green-50 rounded-lg shadow p-4">
                      <div className="space-y-2">
                        {completedTasks.map((task: Task) => (
                          <TaskComponent 
                            key={task.id} 
                            task={task} 
                            isHighlighted={highlightedTaskId === task.id}
                            onAction={handleTaskAction}
                            onUpdate={handleTaskUpdate}
                            onCancelEdit={handleCancelEdit}
                            isEditing={false} // Completed tasks cannot be edited
                            getPriorityStyles={() => 'border-green-500 bg-green-50'}
                            getStatusColor={getStatusColor}
                            getUserName={getUserName}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* No milestones or tasks */}
              {(!project.milestones || project.milestones.length === 0) && 
               (!project.tasks || project.tasks.length === 0) && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500">No milestones or tasks found for this project.</p>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT SIDEBAR (20%) - Action Panel */}
          <div className="w-1/5">
            <div className="space-y-4">
              
              {/* Feedback Messages */}
              {actionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-red-800 text-sm font-medium">❌ {actionError}</p>
                </div>
              )}
              
              {showFeedback && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-green-800 text-sm font-medium">✅ {showFeedback}</p>
                </div>
              )}

              {microFeedback && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
                  <p className="text-blue-800 text-xs font-medium">{microFeedback}</p>
                </div>
              )}

              {/* Action Loading Overlay */}
              {actionLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-4 shadow-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Processing action...</p>
                  </div>
                </div>
              )}

              {/* Project Stabilized Banner */}
              {projectStabilized && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🎉</div>
                    <h3 className="text-lg font-bold mb-1">Project Stabilized ✅</h3>
                    <p className="text-sm">Ready for next stage</p>
                  </div>
                </div>
              )}

              {/* 1. Health Score + Label */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <h3 className="font-semibold text-blue-800 mb-3">Project Health</h3>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Stability</span>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${animatingScore ? 'animate-pulse' : ''} ${
                          healthScore >= 80 ? 'text-green-600' : 
                          healthScore >= 60 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {healthScore}%
                        </span>
                        <div className={`text-xs ${getHealthInterpretation(healthScore).color}`}>
                          {getHealthInterpretation(healthScore).label}
                        </div>
                        {/* Health Trend */}
                        <div className={`text-xs ${healthTrend.trend === 'up' ? 'text-green-600' : healthTrend.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                          {healthTrend.trend === 'up' ? '↑' : healthTrend.trend === 'down' ? '↓' : '→'} {healthTrend.change}%
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                          healthScore >= 80 ? 'bg-green-500' : 
                          healthScore >= 60 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${healthScore}%` }}
                      />
                    </div>
                  </div>
                  {animatingScore && (
                    <div className="ml-4 text-sm text-gray-500">
                      {healthScore > previousHealthScore ? '↑' : '↓'} {Math.abs(healthScore - previousHealthScore)}%
                    </div>
                  )}
                </div>
              </div>

              {/* 2. System Confidence */}
              <div className={`rounded-lg shadow p-4 mb-4 ${
                getSystemConfidence().level === 'HIGH' ? 'bg-green-50 border-green-200' :
                getSystemConfidence().level === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              }`}>
                <h3 className="font-semibold mb-2">
                  System Confidence: 
                  <span className={getSystemConfidence().color}>
                    {getSystemConfidence().level}
                  </span>
                </h3>
                <p className="text-xs text-gray-600">{getSystemConfidence().description}</p>
              </div>

              {/* 3. Stage Readiness */}
              <div className={`rounded-lg shadow p-4 mb-4 ${
                healthBreakdown.escalations === 0 && healthBreakdown.overdue === 0 && healthBreakdown.blocked === 0
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="font-semibold mb-2">
                  Stage Readiness: 
                  <span className={
                    healthBreakdown.escalations === 0 && healthBreakdown.overdue === 0 && healthBreakdown.blocked === 0
                      ? 'text-green-800' 
                      : 'text-red-800'
                  }>
                    {healthBreakdown.escalations === 0 && healthBreakdown.overdue === 0 && healthBreakdown.blocked === 0
                      ? ' Ready ✅'
                      : ' Blocked'
                    }
                  </span>
                </h3>
                <p className="text-xs text-gray-600">
                  {healthBreakdown.escalations === 0 && healthBreakdown.overdue === 0 && healthBreakdown.blocked === 0
                    ? 'Project ready for next stage'
                    : 'Resolve critical issues to proceed'
                  }
                </p>
              </div>

              {/* 4. Top Action (#1) */}
              <div className="bg-white rounded-lg shadow p-4 border-2 border-blue-200 mb-4">
                <h3 className="font-semibold text-blue-800 mb-3">Priority Action</h3>
                {actionPanelData.focusActions.length > 0 ? (
                  <button
                    onClick={() => handleActionClick(actionPanelData.focusActions[0])}
                    className={`w-full text-left p-3 border rounded hover:bg-gray-50 transition-colors ${getPriorityColor(actionPanelData.focusActions[0].priority)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-bold text-blue-600">#1</span>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-white">
                        {actionPanelData.focusActions[0].issueType}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{actionPanelData.focusActions[0].task.title}</p>
                    <p className="text-xs mt-1 text-gray-600">{actionPanelData.focusActions[0].reason}</p>
                    <p className="text-xs mt-2 font-medium text-orange-700">Impact: {actionPanelData.focusActions[0].impact}</p>
                    
                    {/* Time Intelligence */}
                    {(() => {
                      const timeInfo = getTimeIntelligence(actionPanelData.focusActions[0].task);
                      return (
                        <div className="mt-2 text-xs text-gray-500">
                          {timeInfo.overdueDays > 0 && `Overdue for ${timeInfo.overdueDays} days`}
                          {timeInfo.escalatedDays > 0 && ` • Escalated ${timeInfo.escalatedDays} days ago`}
                          {timeInfo.delayedBy !== 'Unassigned' && ` • Delayed by: ${timeInfo.delayedBy}`}
                        </div>
                      );
                    })()}
                    
                    {/* Accountability Pressure */}
                    {(() => {
                      const task = actionPanelData.focusActions[0].task;
                      const timeInfo = getTimeIntelligence(task);
                      if (timeInfo.overdueDays > 0 && timeInfo.delayedBy !== 'Unassigned') {
                        return (
                          <div className="mt-2 text-xs text-red-600 font-medium">
                            Escalated due to delay in assignment
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <p className="text-xs mt-2 font-medium">Click to fix →</p>
                  </button>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-green-600 text-lg mb-2">✅</div>
                    <p className="text-sm text-green-800 font-medium">Project Stable ✅</p>
                    <p className="text-xs text-gray-600 mt-2">Ready for next stage</p>
                  </div>
                )}
              </div>

              {/* 5. Remaining Issues */}
              {actionPanelData.remainingIssues && actionPanelData.remainingIssues.total > 0 && (
                <div className="bg-orange-50 rounded-lg shadow p-4 mb-4">
                  <h3 className="font-semibold text-orange-800 mb-2">
                    Remaining Issues: {actionPanelData.remainingIssues.total}
                    {/* Momentum Indicator */}
                    {actionPanelData.remainingIssues.total === 1 && (
                      <span className="ml-2 text-xs text-green-600 font-medium">→ Almost stable</span>
                    )}
                  </h3>
                  <div className="text-xs text-orange-700 space-y-1">
                    {actionPanelData.remainingIssues.combined.map((issue, index) => (
                      <div key={index}>• {issue}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Business Impact */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <h3 className="font-semibold text-blue-800 mb-2">Business Impact</h3>
                <p className={`text-sm font-medium ${
                  healthBreakdown.escalations > 0 ? 'text-red-600' :
                  healthBreakdown.blocked > 0 ? 'text-orange-600' :
                  healthBreakdown.overdue > 0 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {getBusinessImpact()}
                </p>
              </div>

              {/* 7. Enhanced What Happens Next */}
              {actionPanelData.focusActions.length > 0 && actionPanelData.remainingIssues && (
                <div className="bg-blue-50 rounded-lg shadow p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">What Happens Next</h3>
                  {actionPanelData.remainingIssues.total === 1 ? (
                    <div>
                      <p className="text-sm text-blue-700">
                        Fix this last issue to stabilize project
                      </p>
                      <div className="mt-2 text-xs text-blue-600">
                        Resolving this will:
                        <ul className="mt-1 ml-4 space-y-1">
                          <li>• Remove escalation</li>
                          <li>• Increase health to 80%</li>
                          <li>• Enable stage progression</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-blue-700">
                        After fixing {actionPanelData.remainingIssues.total} more items:
                      </p>
                      <ul className="text-xs text-blue-600 mt-2 space-y-1">
                        {actionPanelData.remainingIssues.escalated > 0 && (
                          <li>• No escalations</li>
                        )}
                        {actionPanelData.remainingIssues.overdue > 0 && (
                          <li>• All overdue tasks resolved</li>
                        )}
                        {actionPanelData.remainingIssues.blocked > 0 && (
                          <li>• No blocked tasks</li>
                        )}
                        <li>• Project enters stable state</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Stage Transition Button */}
              {stageTransition && (
                <div className="bg-green-50 border-green-200 rounded-lg shadow p-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-green-800 mb-2">Ready for Next Stage</h3>
                    <p className="text-sm text-green-700 mb-3">
                      All issues resolved and project stabilized
                    </p>
                    <button
                      onClick={handleStageTransition}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                    >
                      Move to Next Stage
                    </button>
                  </div>
                </div>
              )}

              {/* Immediate Attention - SECTION 1 */}
              {actionPanelData.immediateAttention.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-red-800 mb-3">Immediate Attention</h3>
                  <div className="space-y-2">
                    {actionPanelData.immediateAttention.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleActionClick(action)}
                        className={`w-full text-left p-3 border rounded hover:bg-gray-50 transition-colors ${getPriorityColor(action.priority)}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-white">
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{action.task.title}</p>
                        <p className="text-xs mt-1">{action.reason}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Issues - SECTION 2 */}
              {actionPanelData.otherIssues.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-orange-800 mb-3">Other Issues</h3>
                  <div className="space-y-2">
                    {actionPanelData.otherIssues.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleActionClick(action)}
                        className={`w-full text-left p-2 border rounded hover:bg-gray-50 transition-colors ${getPriorityColor(action.priority)}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-white">
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{action.task.title}</p>
                        <p className="text-xs">{action.reason}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* New Risks (only unseen issues) */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-yellow-800 mb-3">New Risks</h3>
                {actionPanelData.newRisks && actionPanelData.newRisks.length > 0 ? (
                  <div className="space-y-2">
                    {actionPanelData.newRisks.map((risk, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          dispatch({ type: 'HIGHLIGHT_TASK', payload: risk.id });
                          setTimeout(() => dispatch({ type: 'HIGHLIGHT_TASK', payload: null }), 3000);
                          // Scroll to task
                          const element = document.getElementById(`task-${risk.id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className="w-full text-left p-2 bg-yellow-50 border border-yellow-200 rounded hover:bg-yellow-100 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-white">
                            NEW
                          </span>
                        </div>
                        <p className="text-sm font-medium text-yellow-800">{risk.name}</p>
                        <p className="text-xs text-yellow-600">{risk.reason}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No new risks</p>
                )}
              </div>

              {/* Upcoming Risks - PREVENTIVE */}
              <div className="bg-white rounded-lg shadow p-4">
                {actionPanelData.upcomingRisks.length > 0 ? (
                  <div className="space-y-2">
                    {actionPanelData.upcomingRisks.map((risk, index) => (
                      <button
                        key={index}
                        onClick={() => handleAlertClick(risk)}
                        className="w-full text-left p-2 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors"
                      >
                        <p className="text-sm font-medium text-orange-800">{risk.name}</p>
                        <p className="text-xs text-orange-600">
                          Due in {risk.hoursUntilDue} hours
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No upcoming risks</p>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
      
      {/* Assign Modal */}
      {showAssignModal && selectedTaskForAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Assign Task: {selectedTaskForAssign.title}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Assignee</label>
                <div className="space-y-2">
                  {mockUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleAssignTask(user.id)}
                      disabled={actionLoading}
                      className="w-full text-left p-3 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-gray-500">ID: {user.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedTaskForAssign(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Task Component
const TaskComponent: React.FC<{
  task: Task;
  isHighlighted: boolean;
  onAction: (task: Task, action: string) => void;
  onUpdate: (taskId: number, updates: any) => void;
  onCancelEdit: (taskId: number) => void;
  isEditing: boolean;
  getPriorityStyles: (task: Task) => string;
  getStatusColor: (status: string) => string;
  getUserName: (userId: number) => string;
  formatDate: (date: string) => string;
}> = ({ task, isHighlighted, onAction, onUpdate, onCancelEdit, isEditing, getPriorityStyles, getStatusColor, getUserName, formatDate }) => {
  const [editForm, setEditForm] = useState({
    status: task.status,
    assignee_id: task.assignee_id,
    due_date: task.due_date
  });

  const handleSave = () => {
    onUpdate(task.id, editForm);
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const escalated = task.due_date && Math.ceil((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)) > 2;

  // Mock accountable field (in real app this would come from backend)
  const accountableId = task.creator_id; // Using creator as accountable for demo
  const hasAccountable = !!accountableId;

  // Handle extreme overdue display
  const getOverdueDisplay = (task: Task) => {
    if (!task.due_date) return '';
    
    // Check if task is actually overdue first
    const isTaskOverdue = new Date(task.due_date) < new Date();
    if (!isTaskOverdue) {
      // If not overdue, show due date normally
      return `Due: ${formatDate(task.due_date)}`;
    }
    
    // If overdue, show overdue information
    const daysOverdue = Math.ceil((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue > 30) {
      return 'Overdue (Long Pending)';
    }
    return `Overdue by ${daysOverdue} days`;
  };

  // Calculate early completion information
  const getEarlyCompletionInfo = (task: Task) => {
    if (task.status !== 'completed' || !task.due_date || !task.completed_at) return null;
    
    const dueDate = new Date(task.due_date);
    const completedDate = new Date(task.completed_at);
    
    // Check if completed before due date
    if (completedDate <= dueDate) {
      const daysEarly = Math.ceil((dueDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysEarly > 0) {
        return {
          isEarly: true,
          daysEarly,
          text: `Completed ${daysEarly} days early`
        };
      } else if (daysEarly === 0) {
        return {
          isEarly: true,
          daysEarly: 0,
          text: 'Completed on time'
        };
      }
    }
    
    // If completed after due date
    const daysLate = Math.ceil((completedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      isEarly: false,
      daysLate,
      text: `Completed ${daysLate} days late`
    };
  };

  return (
    <div id={`task-${task.id}`} className={`border-l-4 pl-4 py-3 rounded ${getPriorityStyles(task)} ${isHighlighted ? 'ring-2 ring-blue-400' : ''}`}>
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Status</label>
            <select 
              value={editForm.status}
              onChange={(e) => setEditForm({...editForm, status: e.target.value})}
              className="w-full mt-1 p-2 border rounded text-sm"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Owner</label>
            <select 
              value={editForm.assignee_id || ''}
              onChange={(e) => setEditForm({...editForm, assignee_id: parseInt(e.target.value) || undefined})}
              className="w-full mt-1 p-2 border rounded text-sm"
            >
              <option value="">Unassigned</option>
              <option value="2">Sarah Sales</option>
              <option value="3">John PM</option>
              <option value="4">Lisa CSM</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Accountable</label>
            <select 
              value={accountableId || ''}
              onChange={(e) => console.log('Accountable selection (not saved):', e.target.value)}
              className="w-full mt-1 p-2 border rounded text-sm"
            >
              <option value="">Not assigned</option>
              <option value="2">Sarah Sales</option>
              <option value="3">John PM</option>
              <option value="4">Lisa CSM</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Due Date</label>
            <input 
              type="date"
              value={editForm.due_date ? new Date(editForm.due_date).toISOString().split('T')[0] : ''}
              onChange={(e) => setEditForm({...editForm, due_date: e.target.value || undefined})}
              className="w-full mt-1 p-2 border rounded text-sm"
            />
          </div>
          <div className="flex space-x-2">
            <button onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              Save
            </button>
            <button onClick={() => onCancelEdit(task.id)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{task.title}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
                <span className="text-xs text-gray-500">
                  Owner: {task.assignee_id ? getUserName(task.assignee_id) : 'Unassigned'}
                </span>
                <span className="text-xs text-gray-500">
                  Accountable: {accountableId ? getUserName(accountableId) : 'Not assigned'}
                </span>
                {!hasAccountable && (
                  <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                    No accountable
                  </span>
                )}
                {task.due_date && (
                  <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {getOverdueDisplay(task)}
                  </span>
                )}
                {task.status === 'completed' && (() => {
                  const completionInfo = getEarlyCompletionInfo(task);
                  return completionInfo ? (
                    <span className={`text-xs ${completionInfo.isEarly ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}`}>
                      {completionInfo.text}
                    </span>
                  ) : null;
                })()}
                {escalated && (
                  <span className="px-2 py-1 rounded text-xs bg-red-600 text-white">
                    Escalated to Manager
                  </span>
                )}
              </div>
            </div>
            <div className="flex space-x-1">
              {task.status !== 'completed' && (
                <>
                  <button 
                    onClick={() => onAction(task, 'complete')}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    title="Mark task as complete"
                  >
                    Complete
                  </button>
                  <button 
                    onClick={() => onAction(task, 'edit')}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    title="Edit task details"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => onAction(task, 'assign')}
                    className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                    title="Assign task to an owner"
                  >
                    Assign
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectPageWithProvider: React.FC = () => (
  <AppProvider>
    <ProjectPage />
  </AppProvider>
);

export default ProjectPageWithProvider;
