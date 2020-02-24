import { suite, test } from 'mocha-typescript';
import * as sinon from 'sinon';
import DbDAO from '../../db/DbDAO';
import MongoDBConnector from '../../db/MongoDBConnector';
import TwitterService from '../../services/TwitterService';

@suite
class TwitterServiceTestSuite {
  private _runCallback;

  public async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(MongoDBConnector, 'rabbitEventEmitter').value({
      on: (evt, callback) => this._runCallback = callback,
    });
  }

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async testPrivateFunctions(): Promise<void> {
    TwitterService.run();
  }
}
