const prepare = require('mocha-prepare');
const mongoUnit = require('mongo-unit');

prepare(function (done) {
  mongoUnit.start({verbose: false}).then(() => {
    process.env.MONGODB_CONN_URL = mongoUnit.getUrl();
    done();
  });
});
