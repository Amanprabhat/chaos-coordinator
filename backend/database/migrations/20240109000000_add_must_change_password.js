/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('users');
  if (!hasTable) return;

  const addCol = async (col, fn) => {
    const has = await knex.schema.hasColumn('users', col);
    if (!has) {
      await knex.schema.table('users', t => fn(t));
    }
  };

  await addCol('must_change_password', t => t.boolean('must_change_password').notNullable().defaultTo(false));
  await addCol('created_by_admin_id',  t => t.integer('created_by_admin_id').nullable());
};

exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('users');
  if (!hasTable) return;

  await knex.schema.table('users', t => {
    t.dropColumn('must_change_password');
    t.dropColumn('created_by_admin_id');
  });
};
