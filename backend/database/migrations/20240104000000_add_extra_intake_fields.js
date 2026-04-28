/**
 * Migration: Add extra intake fields to projects table
 * - priority, business_objective, go_live_deadline, integration_details,
 *   num_users, current_tools, success_criteria, budget_range
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('projects', (table) => {
    table.string('priority').nullable();              // Critical / High / Medium / Low
    table.text('business_objective').nullable();      // Why is this project being done?
    table.date('go_live_deadline').nullable();        // Hard deadline from client
    table.text('integration_details').nullable();     // Detailed integration notes
    table.string('num_users').nullable();             // Estimated number of users
    table.text('current_tools').nullable();           // Existing tools/systems in use
    table.text('success_criteria').nullable();        // How success is measured
    table.string('budget_range').nullable();          // Budget band
    table.text('project_plan').nullable();            // JSON array of WBS tasks (generated)
    table.date('project_start_date').nullable();      // Set by CSM/PM after approval
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('priority');
    table.dropColumn('business_objective');
    table.dropColumn('go_live_deadline');
    table.dropColumn('integration_details');
    table.dropColumn('num_users');
    table.dropColumn('current_tools');
    table.dropColumn('success_criteria');
    table.dropColumn('budget_range');
    table.dropColumn('project_plan');
    table.dropColumn('project_start_date');
  });
};
