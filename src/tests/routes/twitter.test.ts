/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';
import * as sinon from 'sinon';
import app from '../../App';
import AMQPConnector from '../../db/AMQPConnector';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite
class TwitterApiTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/twitter`;

  public static async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(AMQPConnector, 'channel').value({
      assertExchange: () => {},
      publish: () => {},
    });
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
  }

  @test
  public async getRecentTweets(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/recentTweets`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
