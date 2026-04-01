import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
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
  product_team_ids: number[];
  meeting_done: boolean;
  mom_upload?: File;
  documents_upload?: File;
  expected_timeline: string;
  integrations_required: string;
  notes: string;
  sow_upload?: File;
}

const SalesIntakePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<FormData>({
    project_type: 'POC',
    project_name: '',
    client_name: '',
    client_spoc: {
      name: '',
      email: '',
      mobile: ''
    },
    csm_id: 0,
    pm_id: 0,
    product_team_ids: [],
    meeting_done: false,
    expected_timeline: '',
    integrations_required: '',
    notes: ''
  });

  // Fetch users for team assignment
  const fetchUsers = async () => {
    try {
      // Mock users for now - in production, this would be an API call
      const mockUsers: User[] = [
        { id: 2, name: 'Sarah CSM', email: 'sarah@demo.com', role: 'CSM' },
        { id: 3, name: 'Mike PM', email: 'mike@demo.com', role: 'PM' },
        { id: 4, name: 'Lisa CSM', email: 'lisa@demo.com', role: 'CSM' },
        { id: 5, name: 'John PM', email: 'john@demo.com', role: 'PM' },
        { id: 6, name: 'Emma Product', email: 'emma@demo.com', role: 'PRODUCT' },
        { id: 7, name: 'Alex Product', email: 'alex@demo.com', role: 'PRODUCT' }
      ];
      setUsers(mockUsers);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load team members');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
    switch (step) {
      case 1:
        return formData.project_type === 'POC' || formData.project_type === 'Actual Project';
      case 2:
        return (
          formData.project_name.trim() !== '' &&
          formData.client_name.trim() !== '' &&
          formData.client_spoc.name.trim() !== '' &&
          formData.client_spoc.email.trim() !== '' &&
          formData.client_spoc.mobile.trim() !== ''
        );
      case 3:
        return formData.csm_id > 0;
      case 4:
        if (formData.project_type === 'Actual Project' && !formData.sow_upload) {
          setError('SOW document is required for Actual Projects');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
      console.log('🚀 Creating project:', formData);

      // Create FormData for file uploads
      const submitData = new FormData();
      
      // Add all form fields
      submitData.append('project_name', formData.project_name);
      submitData.append('client_name', formData.client_name);
      submitData.append('project_type', formData.project_type);
      submitData.append('sales_owner_id', String(user?.id || 1));
      
      // Client SPOC
      submitData.append('client_spoc_name', formData.client_spoc.name);
      submitData.append('client_spoc_email', formData.client_spoc.email);
      submitData.append('client_spoc_mobile', formData.client_spoc.mobile);
      
      // Team assignments
      submitData.append('csm_id', String(formData.csm_id));
      if (formData.pm_id) submitData.append('pm_id', String(formData.pm_id));
      if (formData.product_team_ids.length > 0) {
        submitData.append('product_team_ids', JSON.stringify(formData.product_team_ids));
      }
      
      // Handover details
      submitData.append('meeting_done', String(formData.meeting_done));
      submitData.append('expected_timeline', formData.expected_timeline);
      submitData.append('integrations_required', formData.integrations_required);
      submitData.append('notes', formData.notes);
      
      // File uploads
      if (formData.mom_upload) submitData.append('mom_upload', formData.mom_upload);
      if (formData.documents_upload) submitData.append('documents_upload', formData.documents_upload);
      if (formData.sow_upload) submitData.append('sow_upload', formData.sow_upload);

      // Submit to API
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        body: submitData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const result = await response.json();
      console.log('✅ Project created successfully:', result);

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

  const csms = users.filter(u => u.role === 'CSM');
  const pms = users.filter(u => u.role === 'PM');
  const productTeam = users.filter(u => u.role === 'PRODUCT');

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Project Created Successfully!</h2>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
              <p className="text-gray-600">Sales Intake Form</p>
            </div>
            <button
              onClick={() => navigate('/sales-dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Project Type</span>
            <span>Basic Info</span>
            <span>Team Assignment</span>
            <span>Handover Details</span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Project Type */}
          {currentStep === 1 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Type</h2>
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
            </div>
          )}

          {/* Step 2: Basic Info */}
          {currentStep === 2 && (
            <div className="bg-white rounded-lg shadow p-6">
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

          {/* Step 3: Team Assignment */}
          {currentStep === 3 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Assignment</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSM Assignment *
                  </label>
                  <select
                    value={formData.csm_id}
                    onChange={(e) => handleInputChange('csm_id', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select CSM...</option>
                    {csms.map(csm => (
                      <option key={csm.id} value={csm.id}>
                        {csm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PM Assignment (Optional)
                  </label>
                  <select
                    value={formData.pm_id}
                    onChange={(e) => handleInputChange('pm_id', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select PM...</option>
                    {pms.map(pm => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Team (Optional)
                  </label>
                  <div className="space-y-2">
                    {productTeam.map(member => (
                      <label key={member.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.product_team_ids.includes(member.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleInputChange('product_team_ids', [...formData.product_team_ids, member.id]);
                            } else {
                              handleInputChange('product_team_ids', formData.product_team_ids.filter(id => id !== member.id));
                            }
                          }}
                          className="mr-2"
                        />
                        {member.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Handover Details */}
          {currentStep === 4 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Handover Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.meeting_done}
                      onChange={(e) => handleInputChange('meeting_done', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Handover meeting completed</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Minutes (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => handleFileChange('mom_upload', e.target.files?.[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    accept=".pdf,.doc,.docx"
                  />
                  {formData.mom_upload && (
                    <p className="text-sm text-gray-600 mt-1">Selected: {formData.mom_upload.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documents (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => handleFileChange('documents_upload', e.target.files?.[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    accept=".pdf,.doc,.docx,.zip"
                  />
                  {formData.documents_upload && (
                    <p className="text-sm text-gray-600 mt-1">Selected: {formData.documents_upload.name}</p>
                  )}
                </div>

                {formData.project_type === 'Actual Project' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SOW Document *
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleFileChange('sow_upload', e.target.files?.[0])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      accept=".pdf,.doc,.docx"
                      required
                    />
                    {formData.sow_upload && (
                      <p className="text-sm text-gray-600 mt-1">Selected: {formData.sow_upload.name}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Timeline
                  </label>
                  <input
                    type="text"
                    value={formData.expected_timeline}
                    onChange={(e) => handleInputChange('expected_timeline', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 4-6 weeks"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Integrations Required
                  </label>
                  <textarea
                    value={formData.integrations_required}
                    onChange={(e) => handleInputChange('integrations_required', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="List any required integrations..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Any additional information..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating Project...' : 'Create Project'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesIntakePage;
