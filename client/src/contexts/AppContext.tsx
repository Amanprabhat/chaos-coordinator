import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Project, Task } from '../api/api';

// State types
interface AppState {
  project: Project | null;
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
  actionError: string | null;
  resolvedTasks: number[];
  highlightedTaskId: number | null;
  editingTask: number | null;
  showFeedback: string;
  microFeedback: string;
  projectStabilized: boolean;
  stageTransition: boolean;
}

// Action types
type AppAction = 
  | { type: 'SET_PROJECT'; payload: Project }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTION_LOADING'; payload: boolean }
  | { type: 'SET_ACTION_ERROR'; payload: string | null }
  | { type: 'MARK_TASK_RESOLVED'; payload: number }
  | { type: 'HIGHLIGHT_TASK'; payload: number | null }
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'SET_SHOW_FEEDBACK'; payload: string }
  | { type: 'SET_MICRO_FEEDBACK'; payload: string }
  | { type: 'SET_PROJECT_STABILIZED'; payload: boolean }
  | { type: 'SET_STAGE_TRANSITION'; payload: boolean }
  | { type: 'SET_EDITING_TASK'; payload: number | null };

// Initial state
const initialState: AppState = {
  project: null,
  loading: true,
  error: null,
  actionLoading: false,
  actionError: null,
  resolvedTasks: [],
  highlightedTaskId: null,
  editingTask: null,
  showFeedback: '',
  microFeedback: '',
  projectStabilized: false,
  stageTransition: false,
};

// Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload, loading: false, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_ACTION_LOADING':
      return { ...state, actionLoading: action.payload };
    case 'SET_ACTION_ERROR':
      return { ...state, actionError: action.payload };
    case 'MARK_TASK_RESOLVED':
      return { 
        ...state, 
        resolvedTasks: [...state.resolvedTasks, action.payload],
        actionError: null 
      };
    case 'HIGHLIGHT_TASK':
      return { ...state, highlightedTaskId: action.payload };
    case 'CLEAR_FEEDBACK':
      return { ...state, actionError: null };
    case 'SET_SHOW_FEEDBACK':
      return { ...state, showFeedback: action.payload };
    case 'SET_MICRO_FEEDBACK':
      return { ...state, microFeedback: action.payload };
    case 'SET_PROJECT_STABILIZED':
      return { ...state, projectStabilized: action.payload };
    case 'SET_STAGE_TRANSITION':
      return { ...state, stageTransition: action.payload };
    case 'SET_EDITING_TASK':
      return { ...state, editingTask: action.payload };
    default:
      return state;
  }
};

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

// Action creators
export const appActions = {
  setProject: (project: Project) => ({ type: 'SET_PROJECT', payload: project }),
  setLoading: (loading: boolean) => ({ type: 'SET_LOADING', payload: loading }),
  setError: (error: string | null) => ({ type: 'SET_ERROR', payload: error }),
  setActionLoading: (loading: boolean) => ({ type: 'SET_ACTION_LOADING', payload: loading }),
  setActionError: (error: string | null) => ({ type: 'SET_ACTION_ERROR', payload: error }),
  markTaskResolved: (taskId: number) => ({ type: 'MARK_TASK_RESOLVED', payload: taskId }),
  highlightTask: (taskId: number | null) => ({ type: 'HIGHLIGHT_TASK', payload: taskId }),
  clearFeedback: () => ({ type: 'CLEAR_FEEDBACK' }),
  setShowFeedback: (feedback: string) => ({ type: 'SET_SHOW_FEEDBACK', payload: feedback }),
  setMicroFeedback: (feedback: string) => ({ type: 'SET_MICRO_FEEDBACK', payload: feedback }),
  setProjectStabilized: (stabilized: boolean) => ({ type: 'SET_PROJECT_STABILIZED', payload: stabilized }),
  setStageTransition: (transition: boolean) => ({ type: 'SET_STAGE_TRANSITION', payload: transition }),
  setEditingTask: (taskId: number | null) => ({ type: 'SET_EDITING_TASK', payload: taskId }),
};
