/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';

import app from '../../App';
import DbDAO from '../../db/DbDAO';
import { settings } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

@suite
class AppRouterTestSuite {
  private _baseApiRoute = `${settings.routePrefix}/api/lib`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async baseStatisticsExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/statistics`);
    expect(res.type).to.eql('application/json');
  }
}
