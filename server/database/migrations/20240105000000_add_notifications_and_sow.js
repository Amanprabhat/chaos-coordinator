/**
 * Migration: Add notifications table + SOW file fields to projects
 */

exports.up = async function (knex) {
  // ── notifications table ────────────────────────────────────────────────────
  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('project_id').unsigned().nullable().references('id').inTable('projects').onDelete('CASCADE');
    t.integer('task_id').unsigned().nullable();   // no FK — tasks may be deleted
    t.string('type', 50).notNullable();           // task_overdue | task_nudge_manager | project_approved | project_rejected
    t.string('title', 255).notNullable();
    t.text('message').notNullable();
    t.boolean('is_read').defaultTo(false);
    t.boolean('email_sent').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    // Index for fast unread lookups per user
    t.index(['user_id', 'is_read']);
  });

  // ── sow_file_path + sow_file_name on projects ──────────────────────────────
  await knex.schema.alterTable('projects', (t) => {
    t.string('sow_file_path', 500).nullable();
    t.string('sow_file_name', 255).nullable();
    t.string('sow_file_size', 50).nullable();
  });

  // ── nudge_log: track when nudges were sent to avoid spam ──────────────────
  await knex.schema.createTable('nudge_log', (t) => {
    t.increments('id').primary();
    t.integer('task_id').unsigned().notNullable();
    t.integer('user_id').unsigned().notNullable();
    t.string('nudge_type', 30).notNullable();  // 'assignee' | 'manager'
    t.timestamp('sent_at').defaultTo(knex.fn.now());
    t.index(['task_id', 'nudge_type']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('nudge_log');
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('sow_file_path');
    t.dropColumn('sow_file_name');
    t.dropColumn('sow_file_size');
  });
  await knex.schema.dropTableIfExists('notifications');
};
