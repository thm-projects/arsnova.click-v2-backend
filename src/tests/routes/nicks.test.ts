/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';

import app from '../../App';
import DbDAO from '../../db/DbDAO';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite
class NicksApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/nicks`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async getBlockedNicks(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/blocked`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getPredefinedNicks(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/predefined`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
