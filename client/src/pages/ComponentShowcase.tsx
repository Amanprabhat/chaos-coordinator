import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  StatusBadge,
  SuccessBadge,
  WarningBadge,
  DangerBadge,
  InfoBadge,
  AlertCard,
  InsightCard,
  Stepper,
  StepContent,
  Modal,
  ConfirmModal,
  Table,
  List,
  Header,
  Sidebar,
  Layout,
  SimpleLayout,
} from '../components/ui';

const ComponentShowcase: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  // Sample data for table
  const tableData = [
    { id: 1, name: 'Project Alpha', status: 'Active', progress: 75, dueDate: '2024-02-15' },
    { id: 2, name: 'Project Beta', status: 'Planning', progress: 25, dueDate: '2024-03-01' },
    { id: 3, name: 'Project Gamma', status: 'Completed', progress: 100, dueDate: '2024-01-30' },
  ];

  const tableColumns = [
    { key: 'name' as const, title: 'Project Name' },
    { 
      key: 'status' as const, 
      title: 'Status', 
      render: (value: string) => (
        <StatusBadge variant={value === 'Active' ? 'success' : value === 'Planning' ? 'warning' : 'info'}>
          {value}
        </StatusBadge>
      )
    },
    { key: 'progress' as const, title: 'Progress', render: (value: number) => `${value}%` },
    { key: 'dueDate' as const, title: 'Due Date' },
  ];

  // Stepper steps
  const steps = [
    { id: '1', title: 'Project Info', description: 'Basic project details' },
    { id: '2', title: 'Team Setup', description: 'Assign team members' },
    { id: '3', title: 'Timeline', description: 'Set milestones' },
    { id: '4', title: 'Review', description: 'Final review' },
  ];

  // Sidebar items
  const sidebarItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: '📊',
      badge: '3',
    },
    {
      id: 'projects',
      label: 'Projects',
      href: '/projects',
      icon: '📁',
      children: [
        { id: 'active', label: 'Active Projects', href: '/projects/active' },
        { id: 'archived', label: 'Archived', href: '/projects/archived' },
      ],
    },
    {
      id: 'team',
      label: 'Team',
      href: '/team',
      icon: '👥',
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: '⚙️',
    },
  ];

  const user = {
    name: 'John Doe',
    email: 'john@chaos.co',
    role: 'Project Manager',
  };

  return (
    <Layout
      title="Component Showcase"
      subtitle="Complete design system demonstration"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Components' },
      ]}
      user={user}
      sidebarItems={sidebarItems}
      headerActions={
        <div className="flex items-center space-x-3">
          <Button variant="secondary" size="sm">
            Export
          </Button>
          <Button variant="primary" size="sm">
            New Project
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Buttons */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Buttons</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" leftIcon="➕">With Icon</Button>
                <Button variant="primary" rightIcon="→">Right Icon</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Input Fields */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Input Fields</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Email Input"
                type="email"
                placeholder="Enter your email"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                error={inputError}
                helperText="We'll never share your email."
              />
              
              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
              />
              
              <Input
                label="With Icon"
                placeholder="Search..."
                leftIcon="🔍"
              />
              
              <Input
                label="Disabled Input"
                placeholder="Disabled field"
                disabled
              />
            </div>
          </CardBody>
        </Card>

        {/* Status Badges */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Status Badges</h2>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-3">
              <StatusBadge variant="success">Success</StatusBadge>
              <StatusBadge variant="warning">Warning</StatusBadge>
              <StatusBadge variant="danger">Danger</StatusBadge>
              <StatusBadge variant="info">Info</StatusBadge>
              <StatusBadge variant="neutral">Neutral</StatusBadge>
              
              <SuccessBadge>Success</SuccessBadge>
              <WarningBadge>Warning</WarningBadge>
              <DangerBadge>Danger</DangerBadge>
              <InfoBadge>Info</InfoBadge>
            </div>
          </CardBody>
        </Card>

        {/* Alert Cards */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Alert Cards</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <AlertCard
                variant="info"
                title="Information"
                description="This is an informational message."
                dismissible
              />
              
              <AlertCard
                variant="success"
                title="Success!"
                description="Your changes have been saved successfully."
              />
              
              <AlertCard
                variant="warning"
                title="Warning"
                description="Please review your input before proceeding."
              />
              
              <AlertCard
                variant="danger"
                title="Error"
                description="Something went wrong. Please try again."
              />
            </div>
          </CardBody>
        </Card>

        {/* Insight Cards */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Insight Cards</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InsightCard
                title="Active Projects"
                value="12"
                trend="up"
                trendValue="3 this month"
                icon="📊"
                variant="success"
              />
              
              <InsightCard
                title="Pending Tasks"
                value="24"
                trend="down"
                trendValue="5% decrease"
                icon="📋"
                variant="warning"
              />
              
              <InsightCard
                title="Team Members"
                value="8"
                trend="neutral"
                trendValue="No change"
                icon="👥"
              />
            </div>
          </CardBody>
        </Card>

        {/* Stepper */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Stepper Component</h2>
          </CardHeader>
          <CardBody>
            <Stepper
              steps={steps}
              currentStep={currentStep}
              onStepClick={setCurrentStep}
            />
            
            <StepContent step={steps[currentStep]} isActive={true}>
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <p className="text-textSecondary">
                  Content for step: {steps[currentStep].title}
                </p>
                <div className="mt-4 flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                    disabled={currentStep === steps.length - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </StepContent>
          </CardBody>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Table Component</h2>
          </CardHeader>
          <CardBody>
            <Table
              data={tableData}
              columns={tableColumns}
              onRowClick={(item) => console.log('Clicked row:', item)}
            />
          </CardBody>
        </Card>

        {/* Modals */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-textPrimary">Modal Components</h2>
          </CardHeader>
          <CardBody>
            <div className="flex space-x-3">
              <Button onClick={() => setModalOpen(true)}>
                Open Modal
              </Button>
              
              <Button variant="danger" onClick={() => setConfirmModalOpen(true)}>
                Open Confirm Modal
              </Button>
            </div>
            
            <Modal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Example Modal"
              description="This is a sample modal dialog"
              size="md"
            >
              <p className="text-textSecondary mb-4">
                This is the modal content. You can put any content here including forms, tables, or other components.
              </p>
              
              <div className="flex justify-end space-x-3">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setModalOpen(false)}>
                  Save Changes
                </Button>
              </div>
            </Modal>
            
            <ConfirmModal
              isOpen={confirmModalOpen}
              onClose={() => setConfirmModalOpen(false)}
              onConfirm={() => {
                console.log('Confirmed!');
                setConfirmModalOpen(false);
              }}
              title="Delete Item"
              message="Are you sure you want to delete this item? This action cannot be undone."
              confirmText="Delete"
              cancelText="Cancel"
              variant="danger"
            />
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
};

export default ComponentShowcase;
