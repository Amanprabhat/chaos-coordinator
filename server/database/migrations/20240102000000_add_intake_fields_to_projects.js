/**
 * Migration: add sales intake fields to the projects table.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.alterTable('projects', (t) => {
    t.string('project_type', 50).defaultTo('POC');          // POC | Actual Project
    t.string('deployment_region', 100).nullable();
    t.string('deployment_type', 100).nullable();
    t.boolean('sso_required').defaultTo(false);
    t.integer('csm_id').unsigned().nullable().references('id').inTable('users');
    t.integer('pm_id').unsigned().nullable().references('id').inTable('users');
    t.boolean('meeting_done').defaultTo(false);
    t.datetime('meeting_date').nullable();
    t.text('mom_text').nullable();                          // Meeting minutes as text
    t.string('expected_timeline', 255).nullable();
    t.text('integrations_required').nullable();
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('project_type');
    t.dropColumn('deployment_region');
    t.dropColumn('deployment_type');
    t.dropColumn('sso_required');
    t.dropColumn('csm_id');
    t.dropColumn('pm_id');
    t.dropColumn('meeting_done');
    t.dropColumn('meeting_date');
    t.dropColumn('mom_text');
    t.dropColumn('expected_timeline');
    t.dropColumn('integrations_required');
  });
};
