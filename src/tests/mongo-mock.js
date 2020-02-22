const prepare = require('mocha-prepare');
const mongoUnit = require('mongo-unit');

prepare(function (done) {
  mongoUnit.start({verbose: false, dbName: 'test'}).then(() => {
    process.env.MONGODB_CONN_URL = mongoUnit.getUrl();
  }).then(() => {
    return mongoUnit.initDb(process.env.MONGODB_CONN_URL, [])
  }).then(() => {
    return mongoUnit.drop();
  }).then(() => {
    return done();
  });
});
