/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {

  // ── Add private-chat columns to project_discussions ───────────────────────
  const hasDiscussions = await knex.schema.hasTable('project_discussions');
  if (hasDiscussions) {
    const hasPrivate = await knex.schema.hasColumn('project_discussions', 'is_private');
    if (!hasPrivate) {
      await knex.schema.table('project_discussions', (t) => {
        t.boolean('is_private').defaultTo(false).notNullable();
        // JSON-encoded array of tagged user IDs, e.g. [3, 7]
        t.text('tagged_users').nullable();
        // For private threads: optional parent message id
        t.integer('parent_id').nullable().references('id').inTable('project_discussions').onDelete('SET NULL');
      });
    }
  }

  // ── client_requests ────────────────────────────────────────────────────────
  const hasRequests = await knex.schema.hasTable('client_requests');
  if (!hasRequests) {
    await knex.schema.createTable('client_requests', (t) => {
      t.increments('id').primary();
      t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      t.integer('client_user_id').nullable();
      t.string('client_name', 255).notNullable();
      t.string('client_email', 255).notNullable();
      // change_request | new_requirement | additional_help | bug_report | other
      t.string('request_type', 100).notNullable().defaultTo('new_requirement');
      t.string('title', 500).notNullable();
      t.text('description').notNullable();
      t.string('priority', 50).defaultTo('Medium');
      // pending | under_review | approved | rejected | closed
      t.string('status', 50).defaultTo('pending').notNullable();
      t.text('response_comments').nullable();
      t.integer('responded_by').nullable();
      t.timestamp('responded_at').nullable();
      t.timestamp('approved_at').nullable();
      // auto-set to approved_at + 3 days
      t.timestamp('due_date').nullable();
      t.timestamp('closed_at').nullable();
      // FK to project_documents once MoM is uploaded
      t.integer('mom_document_id').nullable();
      t.timestamps(true, true);

      t.index(['project_id', 'status']);
      t.index('client_user_id');
    });
  }

  // ── client_request_votes — deduplicate same request from multiple clients ──
  const hasVotes = await knex.schema.hasTable('client_request_votes');
  if (!hasVotes) {
    await knex.schema.createTable('client_request_votes', (t) => {
      t.increments('id').primary();
      // Points to a "canonical" request (first one raised)
      t.integer('canonical_request_id').notNullable().references('id').inTable('client_requests').onDelete('CASCADE');
      t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      t.integer('client_user_id').nullable();
      t.string('client_name', 255).notNullable();
      t.string('client_email', 255).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      // Prevent same client voting twice
      t.unique(['canonical_request_id', 'client_email']);
    });
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('client_request_votes');
  await knex.schema.dropTableIfExists('client_requests');

  const hasDiscussions = await knex.schema.hasTable('project_discussions');
  if (hasDiscussions) {
    const hasPrivate = await knex.schema.hasColumn('project_discussions', 'is_private');
    if (hasPrivate) {
      await knex.schema.table('project_discussions', (t) => {
        t.dropColumn('is_private');
        t.dropColumn('tagged_users');
        t.dropColumn('parent_id');
      });
    }
  }
};
