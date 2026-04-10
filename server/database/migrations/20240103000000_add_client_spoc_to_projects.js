/**
 * Migration: Add client SPOC fields + product_manager_id to projects table
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('projects', (table) => {
    table.string('client_spoc_name').nullable();
    table.string('client_spoc_email').nullable();
    table.string('client_spoc_mobile').nullable();
    table.integer('product_manager_id').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('client_spoc_name');
    table.dropColumn('client_spoc_email');
    table.dropColumn('client_spoc_mobile');
    table.dropColumn('product_manager_id');
  });
};
