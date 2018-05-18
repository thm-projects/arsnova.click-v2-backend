/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import {suite, test} from 'mocha-typescript';
import * as chai from 'chai';

import app from '../../App';
import {staticStatistics} from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite class NicksApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/nicks`;

  @test async getBlockedNicks() {
    const res = await chai.request(app).get(`${this._baseApiRoute}/blocked`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async getPredefinedNicks() {
    const res = await chai.request(app).get(`${this._baseApiRoute}/predefined`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
