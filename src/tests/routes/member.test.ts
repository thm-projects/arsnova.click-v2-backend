/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';
import * as sinon from 'sinon';
import app from '../../App';
import AMQPConnector from '../../db/AMQPConnector';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { staticStatistics } from '../../statistics';
import { generateQuiz } from '../fixtures';

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
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
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
    await this.initUser();
    const res = await chai.request(app).put(`${this._baseApiRoute}/response`).set('authorization', 'testtoken').send({
      response: [0],
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

  private async initUser(): Promise<any> {
    const quiz = generateQuiz(this._hashtag);
    quiz.currentQuestionIndex = 0;
    const doc = await QuizDAO.addQuiz(quiz);
    await QuizDAO.initQuiz(doc);

    return chai.request(app).put(`${this._baseApiRoute}/`).set('authorization', 'testtoken').send({
      member: {
        name: this._nickname,
        groupName: 'Default',
        token: 'testtoken',
        currentQuizName: this._hashtag,
        responses: MemberDAO.generateResponseForQuiz(quiz.questionList.length),
      },
    });
  }
}
