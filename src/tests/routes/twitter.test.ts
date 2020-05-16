/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import app from '../../App';
import DbDAO from '../../db/DbDAO';
import { settings } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite
class TwitterApiTestSuite {
  private _baseApiRoute = `${settings.routePrefix}/api/v1/twitter`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async getRecentTweets(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/recentTweets`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
