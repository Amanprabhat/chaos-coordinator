/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('client_requests');
  if (!hasTable) return; // safety guard

  const addCol = async (col, fn) => {
    const has = await knex.schema.hasColumn('client_requests', col);
    if (!has) {
      await knex.schema.table('client_requests', t => fn(t));
    }
  };

  await addCol('approval_stage',    t => t.string('approval_stage', 50).defaultTo('csm_review'));
  await addCol('csm_approved_by',   t => t.integer('csm_approved_by').nullable());
  await addCol('csm_approved_at',   t => t.timestamp('csm_approved_at').nullable());
  await addCol('csm_notes',         t => t.text('csm_notes').nullable());
  await addCol('mom_file_path',     t => t.string('mom_file_path', 500).nullable());
  await addCol('mom_attendees',     t => t.text('mom_attendees').nullable());
  await addCol('pm_approved_by',    t => t.integer('pm_approved_by').nullable());
  await addCol('pm_approved_at',    t => t.timestamp('pm_approved_at').nullable());
  await addCol('pm_notes',          t => t.text('pm_notes').nullable());
  await addCol('effort_man_days',   t => t.decimal('effort_man_days', 8, 2).nullable());
  await addCol('effort_hours',      t => t.decimal('effort_hours', 8, 2).nullable());
  await addCol('sales_approved_by', t => t.integer('sales_approved_by').nullable());
  await addCol('sales_approved_at', t => t.timestamp('sales_approved_at').nullable());
  await addCol('sales_notes',       t => t.text('sales_notes').nullable());
  await addCol('billing_type',      t => t.string('billing_type', 50).nullable());
  await addCol('admin_approved_by', t => t.integer('admin_approved_by').nullable());
  await addCol('admin_approved_at', t => t.timestamp('admin_approved_at').nullable());
  await addCol('admin_notes',       t => t.text('admin_notes').nullable());
  await addCol('is_team_visible',   t => t.boolean('is_team_visible').defaultTo(false));
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  const cols = [
    'approval_stage','csm_approved_by','csm_approved_at','csm_notes',
    'mom_file_path','mom_attendees','pm_approved_by','pm_approved_at','pm_notes',
    'effort_man_days','effort_hours','sales_approved_by','sales_approved_at','sales_notes',
    'billing_type','admin_approved_by','admin_approved_at','admin_notes','is_team_visible',
  ];
  const hasTable = await knex.schema.hasTable('client_requests');
  if (!hasTable) return;
  for (const col of cols) {
    const has = await knex.schema.hasColumn('client_requests', col);
    if (has) await knex.schema.table('client_requests', t => t.dropColumn(col));
  }
};
