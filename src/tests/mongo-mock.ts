import * as sinon from 'sinon';
import AMQPConnector from '../db/AMQPConnector';
import DbDAO from '../db/DbDAO';
import MongoDBConnector from '../db/MongoDBConnector';

const prepare = require('mocha-prepare');
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

prepare(async (done) => {
  const sandbox = sinon.createSandbox();
  sandbox.stub(AMQPConnector, 'initConnection').value(() => new Promise(resolve => resolve()));
  sandbox.stub(AMQPConnector, 'channel').value({
    deleteExchange: () => new Promise(resolve => resolve()),
    assertExchange: () => new Promise(resolve => resolve()),
    publish: () => {},
  });

  const mongod = new MongoMemoryServer({ instance: { dbName: 'arsnova-click-v2' } });
  await mongod.ensureInstance();
  MongoDBConnector['_mongoURL'] = await mongod.getUri();
  MongoDBConnector.externalServicesEmitter.on('connected', () => done());

  process.env.MONGODB_DB_MIGRATION_CONN_URL = await mongod.getUri();
  process.env.MONGODB_DB_NAME = 'arsnova-click-v2';
  DbDAO.connectToDb();
});
