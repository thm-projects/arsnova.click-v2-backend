/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';

import app from '../../App';
import QuizDAO from '../../db/quiz/QuizDAO';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1-member';

@suite
class MemberApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/member`;
  private _hashtag = hashtag;
  private _nickname = 'testNickname';

  public static after(): void {
    QuizDAO.removeQuiz(QuizDAO.getQuizByName(hashtag).id);
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async bootstrapQuiz(): Promise<void> {
    const quiz: IQuizEntity = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;
    QuizDAO.initQuiz(quiz);

    await expect(QuizDAO.isActiveQuiz(this._hashtag)).to.be.true;
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
    const res = await chai.request(app).put(`${this._baseApiRoute}/`).send({
      quizName: this._hashtag,
      nickname: this._nickname,
      groupName: 'Default',
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(QuizDAO.getActiveQuizByName(this._hashtag).nextQuestion()).to.equal(0);
  }

  @test
  public async addReadingConfirmation(): Promise<void> {
    const res = await chai.request(app).put(`${this._baseApiRoute}/reading-confirmation`).send({
      quizName: this._hashtag,
      nickname: this._nickname,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addConfidenceValue(): Promise<void> {
    const res = await chai.request(app).put(`${this._baseApiRoute}/confidence-value`).send({
      quizName: this._hashtag,
      nickname: this._nickname,
      confidenceValue: 100,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addResponse(): Promise<void> {
    const res = await chai.request(app).put(`${this._baseApiRoute}/response`).send({
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
}
