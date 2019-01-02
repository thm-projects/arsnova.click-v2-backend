/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';
import * as WebSocket from 'ws';

import app from '../../App';
import QuizDAO from '../../db/quiz/QuizDAO';
import { QuizEntity } from '../../entities/quiz/QuizEntity';
import { SessionConfigurationEntity } from '../../entities/session-configuration/SessionConfigurationEntity';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { WebSocketRouter } from '../../routers/websocket/WebSocketRouter';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite
class LobbyApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/lobby`;
  private _hashtag = hashtag;

  public static before(): void {
    QuizDAO.initQuiz(new QuizEntity({
      name: hashtag,
      memberGroups: [],
      questionList: [],
      sessionConfig: new SessionConfigurationEntity(),
      adminToken: 'test',
      privateKey: 'test',
      readingConfirmationRequested: false,
    }));
    WebSocketRouter.wss = new WebSocket.Server({ port: staticStatistics.port });
  }

  public static after(): void {
    QuizDAO.removeQuiz(QuizDAO.getQuizByName(hashtag).id);
    WebSocketRouter.wss.close();
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async putOpenLobby(): Promise<void> {
    const quiz: IQuizEntity = JSON.parse(
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
    await expect(!QuizDAO.isActiveQuiz(this._hashtag)).to.be.true;
  }
}
