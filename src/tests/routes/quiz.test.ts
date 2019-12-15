/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';
import * as path from 'path';
import app from '../../App';
import QuizDAO from '../../db/QuizDAO';
import { MessageProtocol } from '../../enums/Message';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
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
    staticStatistics.pathToAssets = path.join(__dirname, '..', '..', '..', 'assets');
  }

  public async before(): Promise<void> {
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
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
    expect(res.body.name).to.equal('Demo Quiz ' + ((await QuizDAO.getLastPersistedDemoQuizNumber()) + 1));
  }

  @test
  public async generateAbcdQuiz(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/generate/abcd/en/5`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async getStatusWhenUnavailable(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/status/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Unavailable);
  }

  @test
  public async getStatusWhenAvailable(): Promise<void> {
    const quiz: IQuiz = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;

    const doc = await QuizDAO.addQuiz(quiz);
    await QuizDAO.initQuiz(doc);

    const res = await chai.request(app).get(`${this._baseApiRoute}/status/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Available);
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
  public async readingConfirmation(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/reading-confirmation`).send({
      quizName: this._hashtag,
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async deleteActiveQuiz(): Promise<void> {
    const res = await chai.request(app).del(`${this._baseApiRoute}/active/${this._hashtag}`).set('authorization', this._privateKey).send();
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }
}
