/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {

  // ── rfps ──────────────────────────────────────────────────────────────────
  const hasRfps = await knex.schema.hasTable('rfps');
  if (!hasRfps) {
    await knex.schema.createTable('rfps', t => {
      t.increments('id').primary();
      t.string('title', 255).notNullable();
      t.string('client_name', 255).notNullable();
      t.string('client_contact_name', 255).nullable();
      t.string('client_contact_email', 255).nullable();
      t.string('client_contact_phone', 100).nullable();
      t.decimal('estimated_value', 15, 2).nullable();
      t.string('currency', 10).defaultTo('USD');
      t.date('submission_deadline').nullable();
      t.date('decision_expected_date').nullable();
      t.enu('status', [
        'draft',
        'in_progress',
        'under_review',
        'submitted',
        'won',
        'lost'
      ]).defaultTo('draft');
      t.integer('owner_id').unsigned().references('id').inTable('users').nullable();
      t.text('description').nullable();
      t.text('submission_notes').nullable();
      t.text('outcome_notes').nullable();
      t.integer('linked_project_id').unsigned().references('id').inTable('projects').nullable();
      t.string('priority', 20).defaultTo('medium'); // low | medium | high | critical
      t.string('rfp_source', 100).nullable();       // how the RFP came in
      t.timestamps(true, true);
    });
  }

  // ── rfp_sections ──────────────────────────────────────────────────────────
  const hasSections = await knex.schema.hasTable('rfp_sections');
  if (!hasSections) {
    await knex.schema.createTable('rfp_sections', t => {
      t.increments('id').primary();
      t.integer('rfp_id').unsigned().notNullable().references('id').inTable('rfps').onDelete('CASCADE');
      t.string('title', 255).notNullable();
      t.text('description').nullable();
      t.enu('section_type', [
        'executive_summary',
        'company_overview',
        'technical_solution',
        'implementation_plan',
        'commercial',
        'support_maintenance',
        'compliance',
        'custom'
      ]).defaultTo('custom');
      t.integer('assigned_to_id').unsigned().references('id').inTable('users').nullable();
      t.enu('status', ['not_started', 'in_progress', 'review', 'done']).defaultTo('not_started');
      t.text('content').nullable();               // rich text / markdown response
      t.integer('word_limit').nullable();
      t.date('due_date').nullable();
      t.integer('order_index').defaultTo(0);
      t.boolean('saved_to_library').defaultTo(false);
      t.timestamps(true, true);
    });
  }

  // ── rfp_content_library ───────────────────────────────────────────────────
  const hasLibrary = await knex.schema.hasTable('rfp_content_library');
  if (!hasLibrary) {
    await knex.schema.createTable('rfp_content_library', t => {
      t.increments('id').primary();
      t.string('title', 255).notNullable();
      t.enu('section_type', [
        'executive_summary',
        'company_overview',
        'technical_solution',
        'implementation_plan',
        'commercial',
        'support_maintenance',
        'compliance',
        'custom'
      ]).defaultTo('custom');
      t.text('content').notNullable();
      t.string('tags', 500).nullable();           // comma-separated
      t.integer('used_count').defaultTo(0);
      t.integer('created_by').unsigned().references('id').inTable('users').nullable();
      t.timestamps(true, true);
    });
  }

  // ── rfp_comments ──────────────────────────────────────────────────────────
  const hasComments = await knex.schema.hasTable('rfp_comments');
  if (!hasComments) {
    await knex.schema.createTable('rfp_comments', t => {
      t.increments('id').primary();
      t.integer('rfp_id').unsigned().notNullable().references('id').inTable('rfps').onDelete('CASCADE');
      t.integer('section_id').unsigned().references('id').inTable('rfp_sections').onDelete('CASCADE').nullable();
      t.integer('user_id').unsigned().references('id').inTable('users').nullable();
      t.text('message').notNullable();
      t.timestamps(true, true);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rfp_comments');
  await knex.schema.dropTableIfExists('rfp_content_library');
  await knex.schema.dropTableIfExists('rfp_sections');
  await knex.schema.dropTableIfExists('rfps');
};
