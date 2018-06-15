/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';

import app from '../../App';
import { DatabaseTypes, default as DbDAO } from '../../db/DbDAO';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { staticStatistics } from '../../statistics';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-legacy-api-test';
const privateKey = Math.random().toString(10);

@suite
class LegacyApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api`;
  private _hashtag = hashtag;
  private _privateKey = privateKey;

  public static after(): void {
    QuizManagerDAO.removeQuiz(hashtag);
    DbDAO.delete(DatabaseTypes.quiz, {
      quizName: hashtag,
      privateKey: privateKey,
    });
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    await expect(res.status).to.equal(200);
    await expect(res.type).to.equal('application/json');
  }

  @test
  public async keepalive(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/keepalive`);
    await expect(res.status).to.equal(200);
    await expect(res['text']).to.equal('Ok');
  }

  @test
  public async addHashtag(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/addHashtag`).send({
      sessionConfiguration: {
        hashtag: this._hashtag,
        privateKey: this._privateKey,
      },
    });
    await expect(res.status).to.equal(200);
    await expect(res['text']).to.equal('Hashtag successfully created');
    await expect(QuizManagerDAO.isInactiveQuiz(this._hashtag)).to.be.true;
  }

  @test
  public async createPrivateKey(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/createPrivateKey`);
    await expect(res.status).to.equal(200);
    await expect(res['text']).to.be.a('string');
  }

  @test
  public async openSession(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/openSession`).send({
      sessionConfiguration: {
        hashtag: this._hashtag,
        privateKey: this._privateKey,
      },
    });
    await expect(res.status).to.equal(200);
  }

  @test
  public async updateQuestionGroup(): Promise<void> {
    const quiz: IQuestionGroup = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.hashtag = this._hashtag;
    const res = await chai.request(app).post(`${this._baseApiRoute}/updateQuestionGroup`).send({
      questionGroupModel: quiz,
    });
    await expect(res.status).to.equal(200);
    await expect(res['text']).to.equal(`Session with hashtag ${this._hashtag} successfully updated`);
    await expect(QuizManagerDAO.isActiveQuiz(this._hashtag)).to.be.true;
  }

  @test
  public async showReadingConfirmation(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/showReadingConfirmation`).send({
      sessionConfiguration: {
        hashtag: this._hashtag,
        privateKey: this._privateKey,
      },
    });
    await expect(res.status).to.equal(200);
  }

  @test
  public async startNextQuestion(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/startNextQuestion`).send({
      sessionConfiguration: {
        hashtag: this._hashtag,
        questionIndex: 0,
      },
    });
    await expect(res.status).to.equal(200);
    await expect(res['text']).to.equal(`Next Question with index 0 started.`);
    await expect(QuizManagerDAO.getActiveQuizByName(this._hashtag).currentQuestionIndex).to.equal(0);
  }

  @test
  public async removeLocalData(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/removeLocalData`).send({
      sessionConfiguration: {
        hashtag: this._hashtag,
        privateKey: this._privateKey,
      },
    });
    await expect(res.status).to.equal(200);
    await expect(res['text']).to.equal('Session successfully removed');
    await expect(QuizManagerDAO.isInactiveQuiz(this._hashtag)).to.be.true;
  }
}
