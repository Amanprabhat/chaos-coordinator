const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  
  // Delete existing data
  await knex('activity_logs').del();
  await knex('documents').del();
  await knex('dependencies').del();
  await knex('milestones').del();
  await knex('subtasks').del();
  await knex('tasks').del();
  await knex('projects').del();
  await knex('deals').del();
  await knex('clients').del();
  await knex('users').del();

  // Create users
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const users = await knex('users').insert([
    {
      id: uuidv4(),
      name: 'John Admin',
      email: 'admin@chaoscoordinator.com',
      password_hash: passwordHash,
      role: 'admin',
      department: 'IT',
      is_active: true
    },
    {
      id: uuidv4(),
      name: 'Sarah Sales',
      email: 'sarah@chaoscoordinator.com',
      password_hash: passwordHash,
      role: 'sales',
      department: 'Sales',
      is_active: true
    },
    {
      id: uuidv4(),
      name: 'Mike PM',
      email: 'mike@chaoscoordinator.com',
      password_hash: passwordHash,
      role: 'pm',
      department: 'Operations',
      is_active: true
    },
    {
      id: uuidv4(),
      name: 'Lisa CSM',
      email: 'lisa@chaoscoordinator.com',
      password_hash: passwordHash,
      role: 'csm',
      department: 'Customer Success',
      is_active: true
    },
    {
      id: uuidv4(),
      name: 'Tom Product',
      email: 'tom@chaoscoordinator.com',
      password_hash: passwordHash,
      role: 'product',
      department: 'Product',
      is_active: true
    }
  ]).returning('*');

  const adminUser = users.find(u => u.email === 'admin@chaoscoordinator.com');
  const salesUser = users.find(u => u.email === 'sarah@chaoscoordinator.com');
  const pmUser = users.find(u => u.email === 'mike@chaoscoordinator.com');
  const csmUser = users.find(u => u.email === 'lisa@chaoscoordinator.com');

  // Create clients
  const clients = await knex('clients').insert([
    {
      id: uuidv4(),
      name: 'Acme Corporation',
      industry: 'Technology',
      size: 'Enterprise',
      status: 'active',
      health_score: 85,
      csm_id: csmUser.id
    },
    {
      id: uuidv4(),
      name: 'Global Industries',
      industry: 'Manufacturing',
      size: 'Mid-Market',
      status: 'active',
      health_score: 72,
      csm_id: csmUser.id
    },
    {
      id: uuidv4(),
      name: 'StartupXYZ',
      industry: 'Software',
      size: 'Small',
      status: 'at_risk',
      health_score: 45,
      csm_id: csmUser.id
    }
  ]).returning('*');

  // Create deals
  const deals = await knex('deals').insert([
    {
      id: uuidv4(),
      client_id: clients[0].id,
      sales_rep_id: salesUser.id,
      value: 150000.00,
      close_date: new Date().toISOString().split('T')[0],
      status: 'closed_won',
      handoff_status: 'completed',
      handoff_notes: 'Client needs custom integration with existing ERP system'
    },
    {
      id: uuidv4(),
      client_id: clients[1].id,
      sales_rep_id: salesUser.id,
      value: 75000.00,
      close_date: new Date().toISOString().split('T')[0],
      status: 'closed_won',
      handoff_status: 'pending',
      handoff_notes: 'Standard implementation with training sessions'
    },
    {
      id: uuidv4(),
      client_id: clients[2].id,
      sales_rep_id: salesUser.id,
      value: 25000.00,
      close_date: new Date().toISOString().split('T')[0],
      status: 'closed_won',
      handoff_status: 'pending',
      handoff_notes: 'Budget conscious client, need to watch scope carefully'
    }
  ]).returning('*');

  // Create projects
  const projects = await knex('projects').insert([
    {
      id: uuidv4(),
      name: 'Acme Corporation - Q1 Implementation',
      client_id: clients[0].id,
      deal_id: deals[0].id,
      stage: 'execution',
      status: 'active',
      priority: 'high',
      budget: 150000.00,
      pm_id: pmUser.id,
      start_date: new Date().toISOString().split('T')[0],
      target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Full platform implementation with custom ERP integration'
    },
    {
      id: uuidv4(),
      name: 'Global Industries - Standard Setup',
      client_id: clients[1].id,
      deal_id: deals[1].id,
      stage: 'planning',
      status: 'active',
      priority: 'medium',
      budget: 75000.00,
      pm_id: pmUser.id,
      start_date: new Date().toISOString().split('T')[0],
      target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Standard implementation package with user training'
    },
    {
      id: uuidv4(),
      name: 'StartupXYZ - Quick Start',
      client_id: clients[2].id,
      deal_id: deals[2].id,
      stage: 'kickoff',
      status: 'planning',
      priority: 'low',
      budget: 25000.00,
      pm_id: pmUser.id,
      description: 'Quick start implementation for small business'
    }
  ]).returning('*');

  // Create tasks
  await knex('tasks').insert([
    {
      id: uuidv4(),
      project_id: projects[0].id,
      title: 'Requirements Gathering Workshop',
      description: 'Conduct workshop with stakeholders to gather detailed requirements',
      assignee_id: pmUser.id,
      creator_id: pmUser.id,
      status: 'completed',
      priority: 'high',
      estimated_hours: 8,
      actual_hours: 6,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      project_id: projects[0].id,
      title: 'ERP Integration Architecture Design',
      description: 'Design the technical architecture for ERP system integration',
      assignee_id: pmUser.id,
      creator_id: pmUser.id,
      status: 'in_progress',
      priority: 'high',
      estimated_hours: 40,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      id: uuidv4(),
      project_id: projects[0].id,
      title: 'Custom API Development',
      description: 'Develop custom API endpoints for ERP integration',
      creator_id: pmUser.id,
      status: 'todo',
      priority: 'high',
      estimated_hours: 80,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      id: uuidv4(),
      project_id: projects[1].id,
      title: 'Initial Client Meeting',
      description: 'Kickoff meeting with Global Industries team',
      assignee_id: pmUser.id,
      creator_id: pmUser.id,
      status: 'todo',
      priority: 'medium',
      estimated_hours: 2,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      id: uuidv4(),
      project_id: projects[1].id,
      title: 'Environment Setup',
      description: 'Set up development and testing environments',
      creator_id: pmUser.id,
      status: 'todo',
      priority: 'medium',
      estimated_hours: 16,
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      id: uuidv4(),
      project_id: projects[2].id,
      title: 'Project Planning',
      description: 'Create detailed project plan and timeline',
      assignee_id: pmUser.id,
      creator_id: pmUser.id,
      status: 'blocked',
      priority: 'medium',
      estimated_hours: 12,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Waiting for signed contract from client'
    }
  ]);

  // Create activity logs
  await knex('activity_logs').insert([
    {
      id: uuidv4(),
      entity_type: 'project',
      entity_id: projects[0].id,
      user_id: pmUser.id,
      content: 'Project "Acme Corporation - Q1 Implementation" created',
      action_type: 'created'
    },
    {
      id: uuidv4(),
      entity_type: 'task',
      entity_id: projects[0].id,
      user_id: pmUser.id,
      content: 'Task "Requirements Gathering Workshop" completed',
      action_type: 'completed'
    },
    {
      id: uuidv4(),
      entity_type: 'deal',
      entity_id: deals[0].id,
      user_id: salesUser.id,
      content: 'Handoff initiated for deal to PM Mike PM',
      action_type: 'updated'
    }
  ]);

  console.log('Database seeded successfully!');
  console.log('Login credentials:');
  console.log('Admin: admin@chaoscoordinator.com / password123');
  console.log('Sales: sarah@chaoscoordinator.com / password123');
  console.log('PM: mike@chaoscoordinator.com / password123');
  console.log('CSM: lisa@chaoscoordinator.com / password123');
  console.log('Product: tom@chaoscoordinator.com / password123');
};
