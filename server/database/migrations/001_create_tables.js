exports.up = function(knex) {
  return knex.schema
    .createTable('users', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.string('password_hash').notNullable();
      table.enum('role', ['sales', 'product', 'csm', 'pm', 'admin']).notNullable();
      table.string('department');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('clients', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('name').notNullable();
      table.string('industry');
      table.string('size');
      table.enum('status', ['active', 'inactive', 'at_risk', 'churned']).defaultTo('active');
      table.integer('health_score').defaultTo(80);
      table.string('csm_id').references('id').inTable('users');
      table.timestamps(true, true);
    })
    .createTable('deals', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('client_id').references('id').inTable('clients').notNullable();
      table.string('sales_rep_id').references('id').inTable('users').notNullable();
      table.decimal('value', 12, 2);
      table.date('close_date');
      table.enum('status', ['prospect', 'qualified', 'closed_won', 'closed_lost', 'handed_off']).defaultTo('prospect');
      table.string('contract_url');
      table.enum('handoff_status', ['pending', 'completed', 'rejected']).defaultTo('pending');
      table.text('handoff_notes');
      table.timestamps(true, true);
    })
    .createTable('projects', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('name').notNullable();
      table.string('client_id').references('id').inTable('clients').notNullable();
      table.string('deal_id').references('id').inTable('deals');
      table.enum('stage', ['deal_closed', 'kickoff', 'planning', 'execution', 'review', 'delivery', 'post_delivery']).defaultTo('kickoff');
      table.date('start_date');
      table.date('target_date');
      table.date('actual_date');
      table.enum('status', ['planning', 'active', 'on_hold', 'completed', 'cancelled']).defaultTo('planning');
      table.enum('priority', ['low', 'medium', 'high']).defaultTo('medium');
      table.decimal('budget', 12, 2);
      table.string('pm_id').references('id').inTable('users');
      table.text('description');
      table.timestamps(true, true);
    })
    .createTable('tasks', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('project_id').references('id').inTable('projects').notNullable();
      table.string('title').notNullable();
      table.text('description');
      table.string('assignee_id').references('id').inTable('users');
      table.string('creator_id').references('id').inTable('users').notNullable();
      table.enum('status', ['todo', 'in_progress', 'blocked', 'review', 'completed']).defaultTo('todo');
      table.enum('priority', ['low', 'medium', 'high']).defaultTo('medium');
      table.integer('estimated_hours');
      table.integer('actual_hours');
      table.date('start_date');
      table.date('due_date');
      table.timestamp('completed_at');
      table.text('notes');
      table.timestamps(true, true);
    })
    .createTable('subtasks', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('task_id').references('id').inTable('tasks').notNullable();
      table.string('title').notNullable();
      table.boolean('completed').defaultTo(false);
      table.string('assignee_id').references('id').inTable('users');
      table.timestamp('completed_at');
      table.timestamps(true, true);
    })
    .createTable('milestones', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('project_id').references('id').inTable('projects').notNullable();
      table.string('title').notNullable();
      table.text('description');
      table.date('target_date');
      table.date('completed_date');
      table.enum('status', ['pending', 'completed', 'missed']).defaultTo('pending');
      table.timestamps(true, true);
    })
    .createTable('dependencies', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('task_id').references('id').inTable('tasks').notNullable();
      table.string('depends_on_task_id').references('id').inTable('tasks').notNullable();
      table.enum('dependency_type', ['finish_to_start', 'start_to_start', 'finish_to_finish']).defaultTo('finish_to_start');
      table.timestamps(true, true);
    })
    .createTable('activity_logs', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('entity_type').notNullable();
      table.string('entity_id').notNullable();
      table.string('user_id').references('id').inTable('users').notNullable();
      table.text('content').notNullable();
      table.enum('action_type', ['created', 'updated', 'assigned', 'completed', 'commented', 'status_change']).notNullable();
      table.timestamps(true, true);
    })
    .createTable('documents', function(table) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
      table.string('entity_type').notNullable();
      table.string('entity_id').notNullable();
      table.string('filename').notNullable();
      table.string('url').notNullable();
      table.string('uploaded_by').references('id').inTable('users').notNullable();
      table.string('file_type');
      table.integer('size');
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('documents')
    .dropTableIfExists('activity_logs')
    .dropTableIfExists('dependencies')
    .dropTableIfExists('milestones')
    .dropTableIfExists('subtasks')
    .dropTableIfExists('tasks')
    .dropTableIfExists('projects')
    .dropTableIfExists('deals')
    .dropTableIfExists('clients')
    .dropTableIfExists('users');
};
