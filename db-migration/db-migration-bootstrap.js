const {database, up} = require('migrate-mongo');

async function migrate() {
  const {db, client} = await database.connect();
  const migrated = await up(db, client);
  migrated.forEach(fileName => console.log('[DB-Migration] migrated:', fileName));
}

migrate().catch(reason => {
  console.error(reason);
  process.exit(1)
}).then(() => {
  process.exit(0);
});
