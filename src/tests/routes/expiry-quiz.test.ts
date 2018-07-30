/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';

import app from '../../App';
import LoginDAO from '../../db/LoginDAO';
import { USER_AUTHORIZATION } from '../../Enums';
import { staticStatistics } from '../../statistics';

chai.use(require('chai-http'));
const expect = chai.expect;

@suite
class ExpiryQuizTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/expiry-quiz`;

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async postQuizApiExists(): Promise<void> {
    LoginDAO.initUser({username: 'testuser', passwordHash: 'hash', gitlabToken: '', userAuthorizations: [USER_AUTHORIZATION.CREATE_EXPIRED_QUIZ]});
    LoginDAO.setTokenForUser('testuser', 'token');
    const res = await chai.request(app).post(`${this._baseApiRoute}/quiz`).send({
      quiz: {},
      expiry: new Date(),
      username: 'testuser',
      token: 'token'
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
