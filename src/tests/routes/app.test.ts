// Reference mocha-typescript's global definitions:
/// <reference path="../../../node_modules/mocha-typescript/globals.d.ts" />

import * as chai from 'chai';

import app from '../../App';
import {staticStatistics} from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

@suite class AppRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/`;

  @test async baseStatisticsExists() {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.type).to.eql('application/json');
  }
}
