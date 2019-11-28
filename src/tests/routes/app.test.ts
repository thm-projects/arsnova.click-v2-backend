/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';

import app from '../../App';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

@suite
class AppRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/`;

  public async before(): Promise<void> {
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
  }

  @test
  public async baseStatisticsExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.type).to.eql('application/json');
  }
}
