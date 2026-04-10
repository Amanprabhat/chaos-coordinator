/**
 * Initial schema migration — works for both SQLite (dev) and PostgreSQL (prod).
 *
 * Key cross-DB decisions:
 *  - Use knex.schema methods (no raw SQL) so Knex handles dialect differences
 *  - Timestamps stored as datetime (SQLite) / timestamptz (PostgreSQL)
 *  - JSON columns use .text() on SQLite and .jsonb() on PostgreSQL via a helper
 *  - No AUTOINCREMENT keyword — Knex uses increments() which maps correctly per DB
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  const isPg = knex.client.config.client === 'pg';

  // Helper: pick the right JSON column type per DB
  const jsonCol = (table, col) =>
    isPg ? table.jsonb(col) : table.text(col);

  // ── users ──────────────────────────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name', 255).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255);
    t.enu('role', ['Sales', 'CSM', 'PM', 'Client', 'Admin']).notNullable();
    t.string('department', 100);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true); // created_at, updated_at
  });

  // ── lifecycle_stages ───────────────────────────────────────────────────────
  await knex.schema.createTable('lifecycle_stages', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.integer('display_order').notNullable();
    t.text('description');
    t.timestamps(true, true);
  });

  // ── projects ───────────────────────────────────────────────────────────────
  await knex.schema.createTable('projects', (t) => {
    t.increments('id').primary();
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('client_name', 255);
    t.enu('status', [
      'INTAKE_CREATED',
      'MEETING_SCHEDULED',
      'MEETING_COMPLETED',
      'HANDOVER_PENDING',
      'AWAITING_APPROVAL',
      'APPROVED',
      'ACTIVE',
      'cancelled'
    ]).defaultTo('INTAKE_CREATED');
    t.integer('current_stage_id').unsigned().references('id').inTable('lifecycle_stages');
    t.integer('owner_id').unsigned().notNullable().references('id').inTable('users');
    t.date('start_date');
    t.date('target_go_live_date');
    t.integer('health_score').defaultTo(80);
    t.timestamps(true, true);
  });

  // ── milestones ─────────────────────────────────────────────────────────────
  await knex.schema.createTable('milestones', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.date('due_date');
    t.enu('status', ['pending', 'in_progress', 'completed', 'blocked']).defaultTo('pending');
    t.integer('owner_id').unsigned().notNullable().references('id').inTable('users');
    t.date('completion_date');
    t.timestamps(true, true);
  });

  // ── tasks ──────────────────────────────────────────────────────────────────
  await knex.schema.createTable('tasks', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.integer('milestone_id').unsigned()
      .references('id').inTable('milestones').onDelete('SET NULL');
    t.string('title', 255).notNullable();
    t.text('description');
    t.enu('status', ['todo', 'in_progress', 'completed', 'blocked']).defaultTo('todo');
    t.integer('owner_id').unsigned().notNullable().references('id').inTable('users');
    jsonCol(t, 'contributors'); // JSON array of user IDs
    t.date('due_date');
    t.integer('estimated_hours');
    t.integer('actual_hours');
    t.date('completion_date');
    t.timestamps(true, true);
  });

  // ── risks ──────────────────────────────────────────────────────────────────
  await knex.schema.createTable('risks', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.string('title', 255).notNullable();
    t.text('description');
    t.enu('severity', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
    t.enu('status', ['open', 'mitigated', 'resolved', 'accepted']).defaultTo('open');
    t.integer('owner_id').unsigned().references('id').inTable('users');
    t.timestamps(true, true);
  });

  // ── changes ────────────────────────────────────────────────────────────────
  await knex.schema.createTable('changes', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.string('title', 255).notNullable();
    t.text('description');
    t.enu('status', ['draft', 'pending_approval', 'approved', 'rejected', 'implemented'])
      .defaultTo('draft');
    t.enu('impact', ['low', 'medium', 'high']).defaultTo('medium');
    t.integer('requested_by').unsigned().references('id').inTable('users');
    t.timestamps(true, true);
  });

  // ── handover_notes ─────────────────────────────────────────────────────────
  await knex.schema.createTable('handover_notes', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.enu('from_role', ['Sales', 'CSM', 'PM', 'Client']).notNullable();
    t.enu('to_role', ['Sales', 'CSM', 'PM', 'Client']).notNullable();
    t.text('notes');
    t.boolean('checklist_completed').defaultTo(false);
    t.integer('approved_by').unsigned().references('id').inTable('users');
    t.integer('submitted_by').unsigned().notNullable().references('id').inTable('users');
    t.timestamps(true, true);
  });

  // ── activity_log ───────────────────────────────────────────────────────────
  await knex.schema.createTable('activity_log', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.string('action', 100).notNullable();
    t.text('details'); // JSON stored as text (compatible with both DBs)
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── meetings ───────────────────────────────────────────────────────────────
  await knex.schema.createTable('meetings', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.datetime('meeting_time').notNullable();
    t.integer('duration_minutes').defaultTo(60);
    t.enu('meeting_type', ['kickoff', 'review', 'planning', 'status', 'other']).defaultTo('other');
    t.text('agenda');
    t.text('notes');
    t.enu('status', ['scheduled', 'completed', 'cancelled']).defaultTo('scheduled');
    jsonCol(t, 'attendees');
    jsonCol(t, 'action_items');
    jsonCol(t, 'attendees_present');
    t.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    t.datetime('completed_at');
    t.timestamps(true, true);
  });

  // ── documents ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('documents', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    t.enu('document_type', ['MOM', 'SOW', 'CONTRACT', 'OTHER']).notNullable();
    t.string('document_name', 255).notNullable();
    t.string('file_path', 500).notNullable();
    t.integer('file_size');
    t.string('mime_type', 100);
    t.integer('uploaded_by').unsigned().notNullable().references('id').inTable('users');
    t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    t.timestamps(true, true);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  // Drop in reverse dependency order
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('meetings');
  await knex.schema.dropTableIfExists('activity_log');
  await knex.schema.dropTableIfExists('handover_notes');
  await knex.schema.dropTableIfExists('changes');
  await knex.schema.dropTableIfExists('risks');
  await knex.schema.dropTableIfExists('tasks');
  await knex.schema.dropTableIfExists('milestones');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('lifecycle_stages');
  await knex.schema.dropTableIfExists('users');
};
