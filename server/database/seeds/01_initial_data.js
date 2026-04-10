/**
 * Seed file — inserts lifecycle stages and demo users.
 * Safe to run on both SQLite and PostgreSQL.
 *
 * Usage:
 *   npm run db:seed          (development)
 *   npm run db:seed:prod     (production — caution, will insert demo data)
 */

const { generateProjectPlan } = require('../../modules/projects/wbsGenerator');

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  // ── Lifecycle stages ───────────────────────────────────────────────────────
  await knex('lifecycle_stages').del();
  await knex('lifecycle_stages').insert([
    { id: 1, name: 'Lead',           display_order: 1, description: 'Initial lead qualification stage' },
    { id: 2, name: 'POC',            display_order: 2, description: 'Proof of concept / evaluation stage' },
    { id: 3, name: 'Implementation', display_order: 3, description: 'Active implementation stage' },
    { id: 4, name: 'Go Live',        display_order: 4, description: 'Go-live preparation and execution' },
    { id: 5, name: 'Hypercare',      display_order: 5, description: 'Post-go-live hypercare support' },
  ]);

  // ── Demo users (password: "password123" — bcrypt hash) ────────────────────
  // bcrypt hash of 'password123', rounds=10. Change before real production use.
  const DEMO_HASH = '$2a$10$C1KLjubXtACHUptVKLpWkuWzI3q1j/aoeIm6obNcdmHiCgnvy1iKC';

  await knex('users').del();
  await knex('users').insert([
    { id: 1,  name: 'Admin User',      email: 'admin@demo.com',       role: 'Admin',  department: 'Management',        password_hash: DEMO_HASH, is_active: true },
    { id: 2,  name: 'John Sales',      email: 'sales@demo.com',       role: 'Sales',  department: 'Sales',             password_hash: DEMO_HASH, is_active: true },
    { id: 3,  name: 'Sarah CSM',       email: 'csm@demo.com',         role: 'CSM',    department: 'Customer Success',  password_hash: DEMO_HASH, is_active: true },
    { id: 4,  name: 'Mike PM',         email: 'pm@demo.com',          role: 'PM',     department: 'Project Management',password_hash: DEMO_HASH, is_active: true },
    { id: 5,  name: 'Client User',     email: 'client@demo.com',      role: 'Client', department: 'External',          password_hash: DEMO_HASH, is_active: true },
    { id: 6,  name: 'Priya CSM',       email: 'priya@demo.com',       role: 'CSM',    department: 'Customer Success',  password_hash: DEMO_HASH, is_active: true },
    { id: 7,  name: 'Alex PM',         email: 'alex.pm@demo.com',     role: 'PM',     department: 'Project Management',password_hash: DEMO_HASH, is_active: true },
    { id: 8,  name: 'Emma Product',    email: 'emma@demo.com',        role: 'PM',     department: 'Product',           password_hash: DEMO_HASH, is_active: true },
    { id: 9,  name: 'Raj Product',     email: 'raj@demo.com',         role: 'PM',     department: 'Product',           password_hash: DEMO_HASH, is_active: true },
    { id: 10, name: 'Lisa Product',    email: 'lisa@demo.com',        role: 'PM',     department: 'Product',           password_hash: DEMO_HASH, is_active: true },
  ]);

  // ── Generate WBS plans for demo projects ──────────────────────────────────
  // Project 1: ACTIVE — has start date, standard plan (no integrations)
  const plan1 = generateProjectPlan({
    startDate: '2026-03-03',
    hasIntegrations: false,
    momText: '',
    integrationDetails: '',
  });

  // Project 2: APPROVED — tentative plan (no start date yet), has integrations
  const plan2 = generateProjectPlan({
    startDate: null,
    hasIntegrations: true,
    momText: '',
    integrationDetails: 'Salesforce CRM + Slack notifications',
  });

  // Project 4: APPROVED — tentative plan, standard
  const plan4 = generateProjectPlan({
    startDate: null,
    hasIntegrations: false,
    momText: '',
    integrationDetails: '',
  });

  // ── Demo projects ──────────────────────────────────────────────────────────
  await knex('projects').del();
  await knex('projects').insert([
    {
      id: 1,
      name: 'Acme Corp — CRM Implementation',
      description: 'Full CRM platform rollout for Acme Corp sales and support teams.',
      client_name: 'Acme Corp',
      status: 'ACTIVE',
      current_stage_id: 3,
      owner_id: 2,                     // John Sales submitted intake
      csm_id: 3,                       // Sarah CSM assigned
      pm_id: 4,                        // Mike PM assigned
      priority: 'High',
      project_type: 'Actual Project',
      deployment_region: 'US East',
      deployment_type: 'Cloud (SaaS)',
      sso_required: true,
      meeting_done: true,
      meeting_date: '2026-02-28T10:00:00',
      mom_text: 'Discussed CRM requirements. Client needs pipeline tracking, email integration, and 50-seat license. Go-live by Q2 2026. Integration with existing ERP required.',
      expected_timeline: 'Q2 2026',
      integrations_required: 'No',
      business_objective: 'Replace legacy spreadsheet-based pipeline tracking with a unified CRM to improve sales forecasting accuracy and reduce deal cycle time by 30%.',
      go_live_deadline: '2026-06-30',
      num_users: '50',
      current_tools: 'Google Sheets, Outlook, Slack',
      success_criteria: 'All 50 users onboarded, pipeline accuracy above 85%, go-live within budget.',
      budget_range: '$50k–$100k',
      client_spoc_name: 'Jennifer Walsh',
      client_spoc_email: 'j.walsh@acmecorp.com',
      client_spoc_mobile: '+1 555-0192',
      start_date: '2026-03-03',
      target_go_live_date: '2026-06-30',
      project_start_date: '2026-03-03',
      project_plan: JSON.stringify(plan1),
      health_score: 85,
    },
    {
      id: 2,
      name: 'Tech Startup — Mobile Platform',
      description: 'Native iOS and Android app with Salesforce and Slack integrations.',
      client_name: 'Tech Startup Inc',
      status: 'APPROVED',
      current_stage_id: 2,
      owner_id: 2,                     // John Sales
      csm_id: 6,                       // Priya CSM assigned
      pm_id: 7,                        // Alex PM assigned
      priority: 'Critical',
      project_type: 'Actual Project',
      deployment_region: 'US West',
      deployment_type: 'Cloud (SaaS)',
      sso_required: false,
      meeting_done: true,
      meeting_date: '2026-03-10T14:00:00',
      mom_text: 'Client confirmed mobile-first strategy. Need Salesforce CRM sync and Slack notifications for deal alerts. 120 users across sales and operations teams.',
      expected_timeline: 'Q3 2026',
      integrations_required: 'Yes',
      integration_details: 'Salesforce CRM for data sync (bidirectional). Slack for real-time deal notifications via webhook.',
      business_objective: 'Enable field sales team to access and update CRM data on-the-go, reducing data entry lag from 48 hours to under 1 hour.',
      go_live_deadline: '2026-09-30',
      num_users: '120',
      current_tools: 'Salesforce, Slack, Jira',
      success_criteria: 'Mobile app DAU above 80%, Salesforce sync latency under 5 mins, zero data loss incidents at go-live.',
      budget_range: '$100k–$250k',
      client_spoc_name: 'David Park',
      client_spoc_email: 'd.park@techstartup.io',
      client_spoc_mobile: '+1 555-0847',
      start_date: '2026-03-10',
      target_go_live_date: '2026-09-30',
      project_start_date: null,        // Not set yet — CSM/PM to set after kickoff
      project_plan: JSON.stringify(plan2),
      health_score: 75,
    },
    {
      id: 3,
      name: 'Retail Co — Marketing Automation',
      description: 'Q3 marketing automation platform with email and SMS campaigns.',
      client_name: 'Retail Co',
      status: 'AWAITING_APPROVAL',
      current_stage_id: 1,
      owner_id: 2,
      priority: 'Medium',
      project_type: 'POC',
      deployment_region: 'EU',
      deployment_type: 'Cloud (SaaS)',
      sso_required: false,
      meeting_done: true,
      meeting_date: '2026-04-02T11:00:00',
      mom_text: 'Client evaluating email automation with A/B testing. Budget TBD pending board approval. No integrations required in phase 1.',
      expected_timeline: 'Q4 2026',
      integrations_required: 'No',
      business_objective: 'Automate email and SMS marketing campaigns to reduce manual effort and improve campaign ROI by 20%.',
      go_live_deadline: '2026-12-01',
      num_users: '15',
      current_tools: 'Mailchimp, HubSpot (limited), Excel',
      success_criteria: 'First automated campaign deployed within 30 days of go-live, open rate above 25%.',
      budget_range: 'Under $50k',
      client_spoc_name: 'Angela Torres',
      client_spoc_email: 'a.torres@retailco.com',
      client_spoc_mobile: '+44 7700 900142',
      start_date: '2026-04-01',
      target_go_live_date: '2026-12-01',
      health_score: 90,
    },
    {
      id: 4,
      name: 'HealthFirst — Patient Portal',
      description: 'Patient-facing portal for appointment scheduling and health records.',
      client_name: 'HealthFirst Group',
      status: 'APPROVED',
      current_stage_id: 2,
      owner_id: 2,
      csm_id: 3,                       // Sarah CSM (same as project 1 — show multiple)
      pm_id: 4,                        // Mike PM
      product_manager_id: 8,           // Emma Product
      priority: 'High',
      project_type: 'Actual Project',
      deployment_region: 'US East',
      deployment_type: 'On-Premise',
      sso_required: true,
      meeting_done: true,
      meeting_date: '2026-03-25T09:30:00',
      mom_text: 'Healthcare client requires HIPAA-compliant deployment. Patient portal must integrate with existing EMR system. Strict go-live deadline tied to contract renewal.',
      expected_timeline: 'Q3 2026',
      integrations_required: 'No',
      business_objective: 'Provide patients with self-service scheduling and secure messaging to reduce call centre volume by 40%.',
      go_live_deadline: '2026-08-15',
      num_users: '200',
      current_tools: 'Legacy EMR, Email, Phone',
      success_criteria: '90% patient adoption within 60 days, zero HIPAA violations, call centre volume down 40%.',
      budget_range: '$100k–$250k',
      client_spoc_name: 'Dr. Ravi Menon',
      client_spoc_email: 'r.menon@healthfirst.org',
      client_spoc_mobile: '+1 555-0334',
      start_date: '2026-04-01',
      target_go_live_date: '2026-08-15',
      project_start_date: null,
      project_plan: JSON.stringify(plan4),
      health_score: 80,
    },
    {
      id: 5,
      name: 'LogiTech — Warehouse Management',
      description: 'WMS rollout for 3 distribution centres with barcode scanning.',
      client_name: 'LogiTech Logistics',
      status: 'INTAKE_CREATED',
      current_stage_id: 1,
      owner_id: 2,
      priority: 'Low',
      project_type: 'POC',
      deployment_region: 'US Midwest',
      deployment_type: 'On-Premise',
      sso_required: false,
      meeting_done: false,
      expected_timeline: 'Q1 2027',
      integrations_required: 'No',
      business_objective: 'Digitise warehouse pick-and-pack process to reduce fulfilment errors by 50%.',
      go_live_deadline: '2027-03-01',
      num_users: '80',
      current_tools: 'Paper-based, Excel',
      success_criteria: 'Error rate below 0.5%, scan accuracy above 99.9%.',
      budget_range: '$50k–$100k',
      client_spoc_name: 'Tom Bradley',
      client_spoc_email: 't.bradley@logitech-logistics.com',
      client_spoc_mobile: '+1 555-0781',
      start_date: null,
      target_go_live_date: '2027-03-01',
      health_score: 70,
    },
  ]);

  // ── Demo milestones ────────────────────────────────────────────────────────
  await knex('milestones').del();
  await knex('milestones').insert([
    { project_id: 1, name: 'Kickoff & Requirements Sign-off', description: 'Project kickoff meeting and requirements finalised', due_date: '2026-03-10', status: 'completed',  owner_id: 3, completion_date: '2026-03-08' },
    { project_id: 1, name: 'Core Configuration Complete',      description: 'CRM system configured per requirements',            due_date: '2026-04-15', status: 'in_progress',owner_id: 4 },
    { project_id: 1, name: 'UAT Sign-off',                     description: 'User acceptance testing passed by client',          due_date: '2026-05-20', status: 'pending',    owner_id: 3 },
    { project_id: 2, name: 'Integration Architecture Review',  description: 'Salesforce and Slack integration design approved',   due_date: '2026-05-01', status: 'pending',    owner_id: 7 },
    { project_id: 4, name: 'HIPAA Compliance Review',          description: 'Security and compliance assessment completed',       due_date: '2026-05-15', status: 'pending',    owner_id: 3 },
  ]);

  // ── Demo tasks ─────────────────────────────────────────────────────────────
  await knex('tasks').del();
  await knex('tasks').insert([
    { project_id: 1, title: 'Configure user roles and permissions',  description: 'Set up role-based access for 50 users',         status: 'in_progress',owner_id: 4, due_date: '2026-04-10' },
    { project_id: 1, title: 'Migrate historical deal data',          description: 'Import 2 years of pipeline data from Sheets',   status: 'todo',       owner_id: 3, due_date: '2026-04-20' },
    { project_id: 1, title: 'Create admin training materials',       description: 'Documentation and video walkthrough for admins', status: 'todo',       owner_id: 3, due_date: '2026-05-10' },
    { project_id: 2, title: 'Salesforce sandbox setup',              description: 'Provision sandbox org for integration testing',  status: 'todo',       owner_id: 7, due_date: '2026-05-05' },
    { project_id: 4, title: 'On-premise environment provisioning',   description: 'Set up servers in client data centre',           status: 'todo',       owner_id: 4, due_date: '2026-05-01' },
  ]);
};
