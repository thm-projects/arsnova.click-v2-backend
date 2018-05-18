/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import {suite, test} from 'mocha-typescript';
import * as chai from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import app from '../../App';
import {IQuestionGroup} from 'arsnova-click-v2-types/src/questions/interfaces';
import {staticStatistics} from '../../statistics';
import {QuizManagerDAO} from '../../db/QuizManagerDAO';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1-member';

@suite class MemberApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/member`;
  private _hashtag = hashtag;
  private _nickname = 'testNickname';

  static after() {
    QuizManagerDAO.removeQuiz(hashtag);
  }

  @test async baseApiExists() {
    const res = await chai.request(app).get(`${this._baseApiRoute}/`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async bootstrapQuiz() {
    QuizManagerDAO.initInactiveQuiz(this._hashtag);
    await expect(QuizManagerDAO.isInactiveQuiz(this._hashtag)).to.be.true;

    const quiz: IQuestionGroup = JSON.parse(fs.readFileSync(
      path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')
    ).toString('UTF-8'));
    quiz.hashtag = this._hashtag;
    QuizManagerDAO.initActiveQuiz(quiz);

    await expect(QuizManagerDAO.isActiveQuiz(this._hashtag)).to.be.true;
  }

  @test async getAllMembers() {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async getRemainingNicks() {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}/available`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async addMember() {
    const res = await chai.request(app).put(`${this._baseApiRoute}/`).send({
      quizName: this._hashtag,
      nickname: this._nickname,
      groupName: 'Default'
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(QuizManagerDAO.getActiveQuizByName(this._hashtag).nextQuestion()).to.equal(0);
  }

  @test async addReadingConfirmation() {
    const res = await chai.request(app).put(`${this._baseApiRoute}/reading-confirmation`).send({
      quizName: this._hashtag,
      nickname: this._nickname
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async addConfidenceValue() {
    const res = await chai.request(app).put(`${this._baseApiRoute}/confidence-value`).send({
      quizName: this._hashtag,
      nickname: this._nickname,
      confidenceValue: 100
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async addResponse() {
    const res = await chai.request(app).put(`${this._baseApiRoute}/response`).send({
      quizName: this._hashtag,
      nickname: this._nickname,
      value: [0]
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async deleteMember() {
    const res = await chai.request(app).del(`${this._baseApiRoute}/${this._hashtag}/${this._nickname}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
