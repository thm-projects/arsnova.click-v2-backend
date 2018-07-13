/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';
import * as WebSocket from 'ws';
import app from '../../App';
import { default as DbDAO } from '../../db/DbDAO';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { DATABASE_TYPE } from '../../Enums';
import { WebSocketRouter } from '../../routes/websocket';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';
const privateKey = Math.random().toString(10);

@suite
class QuizApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/quiz`;
  private _hashtag = hashtag;
  private _privateKey = privateKey;

  public static before(): void {
    WebSocketRouter.wss = new WebSocket.Server({ port: staticStatistics.port });
  }

  public static after(): void {
    QuizManagerDAO.removeQuiz(hashtag);
    DbDAO.delete(DATABASE_TYPE.QUIZ, {
      quizName: hashtag,
      privateKey: privateKey,
    });
    WebSocketRouter.wss.close();
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async generateDemoQuiz(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/generate/demo/en`);
    expect(res.type).to.equal('application/json');
    expect(res.status).to.equal(200);
    expect(res.body.hashtag).to.equal('Demo Quiz ' + (
                                      QuizManagerDAO.getLastPersistedDemoQuizNumber() + 1
    ));
  }

  @test
  public async generateAbcdQuiz(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/generate/abcd/en/5`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getStatusWhenUndefined(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/status/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal('QUIZ:UNDEFINED');
  }

  @test
  public async reserve(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/reserve`).send({
      quizName: this._hashtag,
      privateKey: this._privateKey,
      serverPassword: 'abc',
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    await expect(QuizManagerDAO.isInactiveQuiz(this._hashtag)).to.be.true;
  }

  @test
  public async getStatusWhenExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/status/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal('QUIZ:EXISTS');
  }

  @test
  public async getStatusWhenAvailable(): Promise<void> {
    const quiz: IQuestionGroup = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.hashtag = this._hashtag;
    QuizManagerDAO.initActiveQuiz(quiz);
    const res = await chai.request(app).get(`${this._baseApiRoute}/status/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal('QUIZ:AVAILABLE');
  }

  @test
  public async getCurrentState(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/currentState/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getStartTime(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/currentState/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getSettings(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/settings/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async upload(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/upload`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async start(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/start`).send({
      quizName: this._hashtag,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async stop(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/stop`).send({
      quizName: this._hashtag,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async readingConfirmation(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/reading-confirmation`).send({
      quizName: this._hashtag,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async updateSettings(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/settings/update`).send({
      quizName: this._hashtag,
      target: 'reading-confirmation',
      state: true,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async reset(): Promise<void> {
    const res = await chai.request(app).patch(`${this._baseApiRoute}/reset/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async deleteActiveQuiz(): Promise<void> {
    const res = await chai.request(app).del(`${this._baseApiRoute}/active`).send({
      quizName: this._hashtag,
      privateKey: this._privateKey,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async deleteQuiz(): Promise<void> {
    const res = await chai.request(app).del(`${this._baseApiRoute}/`).send({
      quizName: this._hashtag,
      privateKey: this._privateKey,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
