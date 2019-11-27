/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';
import app from '../../App';
import QuizDAO from '../../db/quiz/QuizDAO';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { staticStatistics } from '../../statistics';
import { generateQuiz } from '../fixtures';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite
class LobbyApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/lobby`;
  private _hashtag = hashtag;

  public async before(): Promise<void> {
    const quiz: IQuiz = generateQuiz(hashtag);
    const doc = await QuizDAO.addQuiz(quiz);
    await QuizDAO.initQuiz(doc);
  }

  public async after(): Promise<void> {
    await QuizDAO.removeQuiz((await QuizDAO.getQuizByName(hashtag)).id);
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async putOpenLobby(): Promise<void> {
    const quiz: IQuiz = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;
    const res = await chai.request(app).put(`${this._baseApiRoute}/`).send({ quiz });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    await expect(QuizDAO.isActiveQuiz(this._hashtag)).to.be.true;
  }

  @test
  public async getLobbyData(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async putCloseLobby(): Promise<void> {
    const res = await chai.request(app).del(`${this._baseApiRoute}/`).send({ quizName: this._hashtag });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    await expect(await QuizDAO.isActiveQuiz(this._hashtag)).to.be.false;
  }
}
