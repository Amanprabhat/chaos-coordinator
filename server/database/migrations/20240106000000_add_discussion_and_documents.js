/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  // ── project_discussions ──────────────────────────────────────────────────
  const hasDiscussions = await knex.schema.hasTable('project_discussions');
  if (!hasDiscussions) {
    await knex.schema.createTable('project_discussions', (t) => {
      t.increments('id').primary();
      t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      t.integer('user_id').nullable();
      t.string('user_name', 255).notNullable();
      t.string('user_role', 50).notNullable();
      t.text('message').notNullable();
      t.timestamps(true, true);
    });
  }

  // ── project_documents ────────────────────────────────────────────────────
  const hasDocuments = await knex.schema.hasTable('project_documents');
  if (!hasDocuments) {
    await knex.schema.createTable('project_documents', (t) => {
      t.increments('id').primary();
      t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      t.integer('user_id').nullable();
      t.string('user_name', 255).notNullable();
      t.string('user_role', 50).notNullable();
      t.string('original_filename', 500).notNullable();
      t.string('stored_filename', 500).notNullable();
      t.bigInteger('file_size').defaultTo(0);
      t.string('mime_type', 200);
      t.string('category', 50).defaultTo('General'); // MoM | SOW | General
      t.text('description').nullable();
      t.timestamps(true, true);
    });
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('project_documents');
  await knex.schema.dropTableIfExists('project_discussions');
};
