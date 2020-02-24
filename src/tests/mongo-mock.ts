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
    assertExchange: () => new Promise(resolve => resolve()),
    publish: () => {},
  });

  const mongod = new MongoMemoryServer({ instance: { dbName: 'arsnova-click-v2' } });
  await mongod.ensureInstance();
  MongoDBConnector['_mongoURL'] = await mongod.getUri();
  MongoDBConnector.externalServicesEmitter.on('connected', () => done());
  DbDAO['connectToDb']();
});
