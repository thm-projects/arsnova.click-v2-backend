/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import {suite, test} from 'mocha-typescript';
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
