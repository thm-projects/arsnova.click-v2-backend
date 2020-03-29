const config = {
  mongodb: {
    url: process.env.MONGODB_DB_MIGRATION_CONN_URL,
    databaseName: process.env.MONGODB_DB_NAME,
    options: {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    }
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog'
};

module.exports = config;
