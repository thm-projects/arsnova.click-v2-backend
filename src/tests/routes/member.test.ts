/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';
import * as routeCache from 'route-cache';
import app from '../../App';
import DbDAO from '../../db/DbDAO';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/QuizDAO';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
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

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async getAllMembers(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getRemainingNicks(): Promise<void> {
    const quiz: IQuiz = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;

    const doc = await QuizDAO.addQuiz(quiz);
    await QuizDAO.initQuiz(doc);

    /* The response is cached so we need to purge the cache */
    routeCache.removeCache(`${this._baseApiRoute}/available/${this._hashtag}`);

    const res = await chai.request(app).get(`${this._baseApiRoute}/available/${this._hashtag}`);
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
  public async getBonustoken(): Promise<void> {
    await this.initUser();
    const res = await chai.request(app).get(`${this._baseApiRoute}/token/bonus`).set('authorization', 'testtoken').send();
    expect(res.status).to.equal(200);
    const bonusToken: string = res.body;
    expect(bonusToken.length).to.equal(64);
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
