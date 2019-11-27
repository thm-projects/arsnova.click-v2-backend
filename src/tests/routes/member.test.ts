/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';
import * as sinon from 'sinon';
import { SuperAgentRequest } from 'superagent';
import app from '../../App';
import AMQPConnector from '../../db/AMQPConnector';
import QuizDAO from '../../db/quiz/QuizDAO';
import { QuizState } from '../../enums/QuizState';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

@suite
class MemberApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/member`;
  private readonly _hashtag = 'mocha-test-api-v1-member';
  private _nickname = 'testNickname';

  public async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(AMQPConnector, 'channel').value({
      assertExchange: () => {},
      publish: () => {},
    });

    const quiz: IQuiz = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;
    quiz.state = QuizState.Active;
    await QuizDAO.addQuiz(quiz);
  }

  public async after(): Promise<void> {
    await QuizDAO.removeQuiz((await QuizDAO.getQuizByName(this._hashtag)).id);
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getAllMembers(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getRemainingNicks(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}/available`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addMember(): Promise<void> {
    const res = await this.initUser();
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addReadingConfirmation(): Promise<void> {
    await this.initUser();
    const res = await chai.request(app).put(`${this._baseApiRoute}/reading-confirmation`).set('authorization', 'testtoken').send();
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addConfidenceValue(): Promise<void> {
    await this.initUser();
    const res = await chai.request(app).put(`${this._baseApiRoute}/confidence-value`).set('authorization', 'testtoken').send({
      confidenceValue: 100,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addResponse(): Promise<void> {
    await chai.request(app).put(`${this._baseApiRoute}/`).set('authorization', 'testtoken').send({
      member: {
        name: this._nickname,
        groupName: 'Default',
        token: 'testtoken',
        currentQuizName: this._hashtag,
      },
    });
    const res = await chai.request(app).put(`${this._baseApiRoute}/response`).set('authorization', 'testtoken').send({
      quizName: this._hashtag,
      nickname: this._nickname,
      value: [0],
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async deleteMember(): Promise<void> {
    const res = await chai.request(app).del(`${this._baseApiRoute}/${this._hashtag}/${this._nickname}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  private initUser(): SuperAgentRequest {
    return chai.request(app).put(`${this._baseApiRoute}/`).set('authorization', 'testtoken').send({
      member: {
        name: this._nickname,
        groupName: 'Default',
        token: 'testtoken',
        currentQuizName: this._hashtag,
      },
    });
  }
}
