const prepare = require('mocha-prepare');
const mongoUnit = require('mongo-unit');

prepare(done => mongoUnit.start({})
.then(testMongoUrl => {
  process.env.MONGODB_CONN_URL = testMongoUrl;
  done()
}));
