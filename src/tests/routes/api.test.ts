/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import { slow, suite, test } from '@testdeck/mocha';
import * as chai from 'chai';

import app from '../../App';
import DbDAO from '../../db/DbDAO';
import { settings } from '../../statistics';

chai.use(require('chai-http'));
const expect = chai.expect;

@suite
class ApiRouterTestSuite {
  private _baseApiRoute = `${settings.routePrefix}/api/v1/`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test @slow(5000)
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
