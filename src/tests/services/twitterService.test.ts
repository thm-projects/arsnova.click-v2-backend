import { suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';
import * as sinon from 'sinon';
import MongoDBConnector from '../../db/MongoDBConnector';
import TwitterService from '../../services/TwitterService';

@suite
class TwitterServiceTestSuite {
  private static _runCallback;

  public static async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(MongoDBConnector, 'rabbitEventEmitter').value({
      on: (evt, callback) => this._runCallback = callback,
    });
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
  }

  @test
  public async testPrivateFunctions(): Promise<void> {
    TwitterService.run();
  }
}
