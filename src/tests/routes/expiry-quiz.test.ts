/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';

import app from '../../App';
import LoginDAO from '../../db/UserDAO';
import { UserRole } from '../../enums/UserRole';
import { AuthService } from '../../services/AuthService';
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
    LoginDAO.initUser({
      name: 'testuser',
      passwordHash: 'hash',
      tokenHash: 'hash',
      privateKey: 'mysecret',
      gitlabToken: '',
      userAuthorizations: [UserRole.CreateExpiredQuiz],
    });
    const user = LoginDAO.getUser('testuser');
    const token = await AuthService.generateToken(user);
    LoginDAO.setTokenForUser('testuser', token);
    const res = await chai.request(app).post(`${this._baseApiRoute}/quiz`).set('authorization', token).send({
      quiz: {},
      expiry: new Date(),
      username: 'testuser',
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
