import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
}

interface ClientSpoc {
  name: string;
  email: string;
  mobile: string;
}

interface FormData {
  project_type: 'POC' | 'Actual Project';
  project_name: string;
  client_name: string;
  client_spoc: ClientSpoc;
  csm_id: number;
  pm_id?: number;
  product_manager_id?: number;
  deployment_region: string;
  deployment_type: string;
  sso_required: boolean;
  meeting_done: boolean;
  meeting_date?: string;
  mom_text: string;
  sow_upload?: File;
  documents_upload?: File;
  expected_timeline: string;
  integrations_required: string;
  notes: string;
  handover_meeting_required: boolean;
  // New fields — Step 1
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  business_objective: string;
  go_live_deadline: string;
  // New fields — Step 4
  integration_details: string;
  num_users: string;
  current_tools: string;
  success_criteria: string;
  budget_range: string;
}

const DRAFT_KEY = (userId?: number) => `cc_intake_draft_${userId ?? 'anon'}`;

const DEFAULT_FORM: FormData = {
  project_type: 'POC',
  project_name: '',
  client_name: '',
  client_spoc: { name: '', email: '', mobile: '' },
  csm_id: 0,
  pm_id: 0,
  product_manager_id: 0,
  deployment_region: '',
  deployment_type: '',
  sso_required: false,
  meeting_done: false,
  meeting_date: '',
  mom_text: '',
  expected_timeline: '',
  integrations_required: '',
  notes: '',
  handover_meeting_required: false,
  // New field defaults
  priority: 'Medium',
  business_objective: '',
  go_live_deadline: '',
  integration_details: '',
  num_users: '',
  current_tools: '',
  success_criteria: '',
  budget_range: '',
};

const SalesIntakePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [meetingScheduled, setMeetingScheduled] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY(user?.id));
    if (saved) {
      try {
        const { step, data } = JSON.parse(saved);
        setFormData(data);
        setCurrentStep(step ?? 1);
        setHasDraft(true);
      } catch {
        // corrupt draft — ignore
      }
    }
  }, [user?.id]);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      // Fallback to seed data if API unavailable
      setUsers([
        { id: 3, name: 'Sarah CSM',  email: 'csm@demo.com',   role: 'CSM' },
        { id: 4, name: 'Mike PM',    email: 'pm@demo.com',     role: 'PM'  },
      ]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const saveDraft = () => {
    // File objects can't be serialised — exclude them
    const { sow_upload, documents_upload, ...serialisable } = formData;
    localStorage.setItem(DRAFT_KEY(user?.id), JSON.stringify({ step: currentStep, data: serialisable }));
    setHasDraft(true);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY(user?.id));
    setHasDraft(false);
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSpocChange = (field: keyof ClientSpoc, value: string) => {
    setFormData(prev => ({
      ...prev,
      client_spoc: {
        ...prev.client_spoc,
        [field]: value
      }
    }));
  };

  const handleFileChange = (field: 'mom_upload' | 'documents_upload' | 'sow_upload', file?: File) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const validateStep = (step: number): boolean => {
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Mobile number validation (numeric only, 10-15 digits)
    const mobileRegex = /^\d{10,15}$/;

    switch (step) {
      case 1:
        if (!formData.project_type) {
          setError('Please select a project type');
          return false;
        }
        if (!formData.deployment_region.trim()) {
          setError('Please select a deployment region');
          return false;
        }
        if (!formData.deployment_type.trim()) {
          setError('Please select a deployment type');
          return false;
        }
        if (!formData.priority) {
          setError('Please select a priority level');
          return false;
        }
        if (!formData.business_objective.trim()) {
          setError('Please describe the business objective');
          return false;
        }
        return true;
      case 2:
        // Validate email format
        if (!emailRegex.test(formData.client_spoc.email.trim())) {
          setError('Please enter a valid email address');
          return false;
        }
        // Validate mobile number (numeric only)
        if (!mobileRegex.test(formData.client_spoc.mobile.trim())) {
          setError('Mobile number must contain only digits (10-15 digits)');
          return false;
        }
        return (
          formData.project_name.trim() !== '' &&
          formData.client_name.trim() !== '' &&
          formData.client_spoc.name.trim() !== '' &&
          formData.client_spoc.email.trim() !== '' &&
          formData.client_spoc.mobile.trim() !== ''
        );
      case 3:
        if (formData.csm_id <= 0) {
          setError('Please assign a CSM before proceeding');
          return false;
        }
        if (!formData.meeting_done) {
          setError('You must complete the kickoff meeting with stakeholders before proceeding to the next step');
          return false;
        }
        return true;
      case 4:
        if (!formData.mom_text.trim()) {
          setError('Meeting Minutes (MoM) are required');
          return false;
        }
        if (!formData.sow_upload) {
          setError('SOW document is required');
          return false;
        }
        if (!formData.num_users.trim()) {
          setError('Please provide the estimated number of users');
          return false;
        }
        if (!formData.success_criteria.trim()) {
          setError('Please describe how success will be measured');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      // validateStep sets its own specific error — don't overwrite it
      return;
    }
    setError('');
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scheduleMeeting = async () => {
    const selectedCSM = users.find(u => u.id === formData.csm_id);
    const selectedPM = formData.pm_id ? users.find(u => u.id === formData.pm_id) : null;
    const selectedProductManager = formData.product_manager_id ? users.find(u => u.id === formData.product_manager_id) : null;

    // Internal team only — no client
    const attendees = [
      user?.email,
      selectedCSM?.email,
      selectedPM?.email,
      selectedProductManager?.email,
    ].filter(Boolean).join(';');

    const subject = encodeURIComponent(`Internal Kickoff: ${formData.project_name || formData.client_name}`);
    const body = encodeURIComponent(`Internal kickoff meeting for project: ${formData.project_name || formData.client_name}
Client: ${formData.client_name}

Attendees:
- Sales: ${user?.name}
- CSM: ${selectedCSM?.name}${selectedPM ? `\n- PM: ${selectedPM.name}` : ''}${selectedProductManager ? `\n- Product: ${selectedProductManager.name}` : ''}

Agenda: Project handover, scope review, next steps.`
    );

    const teamsUrl = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&attendees=${attendees}&content=${body}`;

    // Log meeting scheduling attempt for security tracking
    console.log('🔒 MEETING SCHEDULING ATTEMPT:', {
      project: formData.project_name,
      attendees: attendees.split(';'),
      timestamp: new Date().toISOString(),
      user: user?.email
    });

    window.open(teamsUrl, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build JSON payload — server expects: name, client_name, owner_id
      const payload = {
        name:                  formData.project_name,
        client_name:           formData.client_name,
        owner_id:              user?.id ?? 1,
        description:           formData.notes || undefined,
        project_type:          formData.project_type,
        deployment_region:     formData.deployment_region,
        deployment_type:       formData.deployment_type,
        sso_required:          formData.sso_required,
        csm_id:                formData.csm_id || undefined,
        pm_id:                 formData.pm_id   || undefined,
        product_manager_id:    formData.product_manager_id || undefined,
        meeting_done:          formData.meeting_done,
        meeting_date:          formData.meeting_date || undefined,
        mom_text:              formData.mom_text,
        expected_timeline:     formData.expected_timeline || undefined,
        integrations_required: formData.integrations_required || undefined,
        client_spoc_name:      formData.client_spoc.name  || undefined,
        client_spoc_email:     formData.client_spoc.email || undefined,
        client_spoc_mobile:    formData.client_spoc.mobile || undefined,
        // New fields
        priority:              formData.priority,
        business_objective:    formData.business_objective,
        go_live_deadline:      formData.go_live_deadline,
        integration_details:   formData.integration_details || undefined,
        num_users:             formData.num_users,
        current_tools:         formData.current_tools || undefined,
        success_criteria:      formData.success_criteria,
        budget_range:          formData.budget_range || undefined,
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const result = await response.json();
      console.log('✅ Project created successfully:', result);

      // Upload SOW file if provided (second step after project creation)
      if (formData.sow_upload && result.id) {
        try {
          const sowForm = new FormData();
          sowForm.append('sow_file', formData.sow_upload);
          await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${result.id}/upload-sow`, {
            method: 'POST',
            body: sowForm,
          });
          console.log('✅ SOW uploaded');
        } catch (sowErr) {
          console.warn('SOW upload failed (project still created):', sowErr);
        }
      }

      clearDraft();
      setSuccess(true);

      // Redirect after delay
      setTimeout(() => {
        navigate('/sales-dashboard');
      }, 2000);

    } catch (err) {
      console.error('❌ Failed to create project:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const csms        = users.filter(u => u.role === 'CSM');
  const pms         = users.filter(u => u.role === 'PM' && u.department === 'Project Management');
  const productTeam = users.filter(u => u.role === 'PM' && u.department === 'Product');

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F1F3F9', backgroundImage: 'radial-gradient(circle, #6366f118 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-sm w-full mx-4"
        >
          {/* Animated check */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
            className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200"
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Project Created!</h2>
            <p className="text-sm text-gray-500 mb-1">SOW and details have been sent to Admin for approval.</p>
            <p className="text-xs text-gray-400">Taking you back to the dashboard…</p>
          </motion.div>

          {/* Progress bar */}
          <motion.div className="mt-8 h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const STEPS = ['Project Type', 'Basic Info', 'Team Assignment', 'Handover Details'];

  return (
    <div className="min-h-screen relative">
      {/* Fixed full-viewport background — always visible regardless of scroll */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundColor: '#F1F3F9',
          backgroundImage: 'radial-gradient(circle, #6366f122 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          zIndex: 0,
        }}
      />

      {/* Animated ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 1 }}>
        {/* Top-right indigo orb — slow float */}
        <motion.div
          className="absolute w-[650px] h-[650px] rounded-full"
          style={{ background: 'radial-gradient(circle, #6366f130 0%, transparent 65%)', top: '-160px', right: '-160px' }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Bottom-left violet orb */}
        <motion.div
          className="absolute w-[560px] h-[560px] rounded-full"
          style={{ background: 'radial-gradient(circle, #8b5cf640 0%, transparent 65%)', bottom: '-160px', left: '-100px' }}
          animate={{ x: [0, -30, 30, 0], y: [0, 40, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        {/* Centre-top soft highlight */}
        <motion.div
          className="absolute w-[700px] h-72"
          style={{ background: 'radial-gradient(ellipse, #c7d2fe50 0%, transparent 70%)', top: '-40px', left: '50%', transform: 'translateX(-50%)' }}
          animate={{ opacity: [0.4, 0.7, 0.4], scaleX: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        {/* Small roaming indigo dot — bottom right */}
        <motion.div
          className="absolute w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, #4f46e535 0%, transparent 70%)', bottom: '15%', right: '8%' }}
          animate={{ x: [0, 50, -20, 0], y: [0, -40, 30, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
        />
      </div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-white/60 shadow-sm relative z-10" style={{ zIndex: 10 }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/sales-dashboard')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">New Sales Intake</h1>
              <p className="text-xs text-gray-400 mt-0.5">Step {currentStep} of 4 — {STEPS[currentStep - 1]}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales-dashboard')}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Progress bar */}
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => {
              const step = i + 1;
              const done   = currentStep > step;
              const active = currentStep === step;
              return (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                      done   ? 'bg-emerald-500 text-white' :
                      active ? 'bg-indigo-600 text-white' :
                               'bg-gray-200 text-gray-500'
                    }`}>
                      {done ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : step}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block truncate ${active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full mx-1 transition-colors ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 relative" style={{ zIndex: 10 }}>
        {/* Draft restored banner */}
        {hasDraft && currentStep === 1 && (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-5 text-sm">
            <div className="flex items-center gap-2 text-indigo-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Draft restored</span>
              <span className="text-indigo-500">— your previous progress has been loaded</span>
            </div>
            <button
              type="button"
              onClick={() => { setFormData(DEFAULT_FORM); setCurrentStep(1); clearDraft(); }}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-600 transition-colors ml-4"
            >
              Start fresh
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ── Step 1: Project Type ─────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Type</h2>
              <div className="space-y-4">

                {/* Project Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Project Type *
                  </label>
                  <select
                    value={formData.project_type}
                    onChange={(e) => handleInputChange('project_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select type...</option>
                    <option value="POC">POC</option>
                    <option value="Actual Project">Actual Project</option>
                  </select>
                </div>

                {/* Deployment Region */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deployment Region *
                  </label>
                  <select
                    value={formData.deployment_region}
                    onChange={(e) => handleInputChange('deployment_region', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select region...</option>
                    <option value="US-East">US-East</option>
                    <option value="US-West">US-West</option>
                    <option value="Europe">Europe</option>
                    <option value="Asia-Pacific">Asia-Pacific</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Deployment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deployment Type *
                  </label>
                  <select
                    value={formData.deployment_type}
                    onChange={(e) => handleInputChange('deployment_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select type...</option>
                    <option value="Cloud">Cloud</option>
                    <option value="On-Premise">On-Premise</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                {/* SSO Required */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.sso_required}
                      onChange={(e) => handleInputChange('sso_required', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">SSO Required</span>
                  </label>
                </div>

                {/* ── NEW: Priority ── */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* ── NEW: Business Objective ── */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Business Objective <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">What business problem does this solve?</p>
                  <textarea
                    value={formData.business_objective}
                    onChange={(e) => handleInputChange('business_objective', e.target.value)}
                    rows={3}
                    placeholder="Describe the business problem this project addresses..."
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-colors ${
                      formData.business_objective.trim() ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-300 bg-white'
                    }`}
                    required
                  />
                </div>

                {/* ── NEW: Go-Live Deadline ── */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Go-Live Deadline <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Client's target go-live date, if known</p>
                  <input
                    type="date"
                    value={formData.go_live_deadline}
                    onChange={(e) => handleInputChange('go_live_deadline', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

              </div>
            </div>
          )}

          {/* ── Step 2: Basic Info ───────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => handleInputChange('project_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => handleInputChange('client_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter client name"
                    required
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Client SPOC Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SPOC Name *
                      </label>
                      <input
                        type="text"
                        value={formData.client_spoc.name}
                        onChange={(e) => handleSpocChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="SPOC name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SPOC Email *
                      </label>
                      <input
                        type="email"
                        value={formData.client_spoc.email}
                        onChange={(e) => handleSpocChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="spoc@client.com"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SPOC Mobile *
                      </label>
                      <input
                        type="text"
                        value={formData.client_spoc.mobile}
                        onChange={(e) => handleSpocChange('mobile', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+1 234 567 8900"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Team Assignment + Meeting Gate ───────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {/* Team Selection */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Team Assignment</h2>
                <p className="text-sm text-gray-500 mb-5">Assign internal stakeholders who will attend the kickoff meeting</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CSM Assignment <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.csm_id}
                      onChange={(e) => { handleInputChange('csm_id', parseInt(e.target.value)); setError(''); }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      required
                    >
                      <option value="">Select CSM...</option>
                      {csms.map(csm => (
                        <option key={csm.id} value={csm.id}>{csm.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Manager <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.pm_id}
                      onChange={(e) => handleInputChange('pm_id', parseInt(e.target.value))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="">Select Project Manager...</option>
                      {pms.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Team Member <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.product_manager_id || ''}
                      onChange={(e) => handleInputChange('product_manager_id', e.target.value ? parseInt(e.target.value) : 0)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="">Select Product Team Member...</option>
                      {productTeam.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Meeting Gate — only shows once CSM is selected */}
              {formData.csm_id > 0 && (
                <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${
                  formData.meeting_done ? 'border-emerald-200' : 'border-amber-200'
                }`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Kickoff Meeting</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        You must complete a kickoff meeting with all stakeholders before uploading documents
                      </p>
                    </div>
                    {formData.meeting_done ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full flex-shrink-0">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full flex-shrink-0">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Attendees preview */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Internal Meeting Attendees</p>
                    <div className="space-y-2">
                      {/* Sales — current user */}
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {user?.name?.[0] ?? 'S'}
                        </div>
                        <span>{user?.name ?? 'You'}</span>
                        <span className="text-xs text-gray-400 ml-1">Sales</span>
                      </div>
                      {/* CSM */}
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold flex-shrink-0">
                          {users.find(u => u.id === formData.csm_id)?.name[0] ?? 'C'}
                        </div>
                        <span>{users.find(u => u.id === formData.csm_id)?.name}</span>
                        <span className="text-xs text-gray-400 ml-1">CSM</span>
                      </div>
                      {/* PM — optional */}
                      {(formData.pm_id ?? 0) > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold flex-shrink-0">
                            {users.find(u => u.id === formData.pm_id)?.name[0] ?? 'P'}
                          </div>
                          <span>{users.find(u => u.id === formData.pm_id)?.name}</span>
                          <span className="text-xs text-gray-400 ml-1">PM</span>
                        </div>
                      )}
                      {/* Product — optional */}
                      {(formData.product_manager_id ?? 0) > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-[10px] font-bold flex-shrink-0">
                            {users.find(u => u.id === formData.product_manager_id)?.name[0] ?? 'T'}
                          </div>
                          <span>{users.find(u => u.id === formData.product_manager_id)?.name}</span>
                          <span className="text-xs text-gray-400 ml-1">Product</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule button */}
                  <button
                    type="button"
                    onClick={() => { scheduleMeeting(); setMeetingScheduled(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors mb-5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {meetingScheduled ? 'Open Teams Calendar Again' : 'Schedule Meeting via Teams'}
                  </button>

                  {/* Meeting confirmation */}
                  <div className={`rounded-xl border p-4 transition-all ${
                    formData.meeting_done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <p className="text-xs font-semibold text-gray-600 mb-3">Meeting Confirmation</p>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.meeting_done}
                        onChange={(e) => { handleInputChange('meeting_done', e.target.checked); setError(''); }}
                        className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 leading-snug">
                        I confirm the kickoff meeting has been <strong>completed</strong> with all assigned stakeholders
                      </span>
                    </label>

                    {formData.meeting_done && (
                      <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Meeting Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          value={formData.meeting_date || ''}
                          onChange={(e) => handleInputChange('meeting_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    )}

                    {formData.meeting_done && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-700 text-xs font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Meeting confirmed — you can now proceed to upload documents
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Documents & Project Details ─────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Meeting summary banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Kickoff meeting completed</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {formData.meeting_date
                      ? `Held on ${new Date(formData.meeting_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : 'Meeting confirmed — now upload the required documents below'}
                  </p>
                </div>
              </div>

              {/* Documents card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Upload Documents</h2>
                <p className="text-sm text-gray-500 mb-5">Upload the meeting minutes and any supporting documents to complete the project creation</p>

                <div className="space-y-5">
                  {/* MoM — textarea */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Meeting Minutes (MoM) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.mom_text}
                      onChange={(e) => handleInputChange('mom_text', e.target.value)}
                      rows={6}
                      placeholder="Summarise what was discussed and agreed in the kickoff meeting — key decisions, scope, next steps..."
                      className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-colors ${
                        formData.mom_text.trim() ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-300 bg-white'
                      }`}
                    />
                    <p className="text-xs text-gray-400 mt-1">{formData.mom_text.length} characters</p>
                  </div>

                  {/* SOW — always mandatory */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Statement of Work (SOW) <span className="text-red-500">*</span>
                    </label>
                    <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                      formData.sow_upload ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-indigo-300 bg-gray-50'
                    }`}>
                      {formData.sow_upload ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-emerald-700">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="truncate">{formData.sow_upload.name}</span>
                          </div>
                          <button type="button" onClick={() => handleFileChange('sow_upload', undefined)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-3">Remove</button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <svg className="w-8 h-8 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Attach SOW document</p>
                            <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX — click to browse</p>
                          </div>
                          <input type="file" className="hidden" onChange={(e) => handleFileChange('sow_upload', e.target.files?.[0])} accept=".pdf,.doc,.docx" />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Additional documents */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Additional Documents <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                      formData.documents_upload ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-indigo-300 bg-gray-50'
                    }`}>
                      {formData.documents_upload ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-emerald-700">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="truncate">{formData.documents_upload.name}</span>
                          </div>
                          <button type="button" onClick={() => handleFileChange('documents_upload', undefined)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-3">Remove</button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <svg className="w-8 h-8 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Attach supporting files</p>
                            <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, ZIP — click to browse</p>
                          </div>
                          <input type="file" className="hidden" onChange={(e) => handleFileChange('documents_upload', e.target.files?.[0])} accept=".pdf,.doc,.docx,.zip" />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Details */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Project Details</h3>
                <div className="space-y-4">

                  {/* Expected Timeline */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected Timeline</label>
                    <input
                      type="text"
                      value={formData.expected_timeline}
                      onChange={(e) => handleInputChange('expected_timeline', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., 4–6 weeks"
                    />
                  </div>

                  {/* ── NEW: Estimated Number of Users ── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Estimated Number of Users <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.num_users}
                      onChange={(e) => handleInputChange('num_users', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., 500"
                      required
                    />
                  </div>

                  {/* Integrations Required — moved before Integration Details */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Integrations Required</label>
                    <textarea
                      value={formData.integrations_required}
                      onChange={(e) => handleInputChange('integrations_required', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={2}
                      placeholder="List any required integrations..."
                    />
                  </div>

                  {/* ── NEW: Current Tools ── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Current Tools / Systems <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={formData.current_tools}
                      onChange={(e) => handleInputChange('current_tools', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={2}
                      placeholder="Current tools/systems in use by client..."
                    />
                  </div>

                  {/* ── NEW: Success Criteria ── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Success Criteria <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-400 mb-2">How will success be measured?</p>
                    <textarea
                      value={formData.success_criteria}
                      onChange={(e) => handleInputChange('success_criteria', e.target.value)}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-colors ${
                        formData.success_criteria.trim() ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-300 bg-white'
                      }`}
                      rows={3}
                      placeholder="Define the KPIs, milestones, or outcomes that will indicate project success..."
                      required
                    />
                  </div>

                  {/* ── NEW: Budget Range ── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Budget Range <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.budget_range}
                      onChange={(e) => handleInputChange('budget_range', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="">Select budget range...</option>
                      <option value="< $50K">&lt; $50K</option>
                      <option value="$50K–$100K">$50K–$100K</option>
                      <option value="$100K–$250K">$100K–$250K</option>
                      <option value="$250K–$500K">$250K–$500K</option>
                      <option value="> $500K">&gt; $500K</option>
                    </select>
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                      placeholder="Any additional context for the team..."
                    />
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ── Navigation Buttons ───────────────────────────────────────── */}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3">
              {/* Save as Draft — available on all steps except final submit */}
              {currentStep < 4 && (
                <button
                  type="button"
                  onClick={saveDraft}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {draftSaved ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-600">Saved</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save as Draft
                    </>
                  )}
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentStep === 3 && !formData.meeting_done}
                  title={currentStep === 3 && !formData.meeting_done ? 'Complete the kickoff meeting first' : undefined}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {currentStep === 3 ? 'Next: Upload Documents' : 'Next'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating Project...
                    </>
                  ) : (
                    <>
                      Create Project
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesIntakePage;
