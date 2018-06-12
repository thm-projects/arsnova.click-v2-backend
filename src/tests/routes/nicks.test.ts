/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';

import app from '../../App';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite
class NicksApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/nicks`;

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
