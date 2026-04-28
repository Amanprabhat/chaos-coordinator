exports.up = async function (knex) {
  const hasProvider = await knex.schema.hasColumn('users', 'sso_provider');
  const hasSubject  = await knex.schema.hasColumn('users', 'sso_subject');

  await knex.schema.alterTable('users', t => {
    if (!hasProvider) t.string('sso_provider', 50).nullable();  // e.g. 'azure'
    if (!hasSubject)  t.string('sso_subject', 255).nullable();  // Azure OID claim
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', t => {
    t.dropColumn('sso_provider');
    t.dropColumn('sso_subject');
  });
};
