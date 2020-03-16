/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { suite, test, timeout } from 'mocha-typescript';
import { ObjectId } from 'mongodb';
import * as path from 'path';
import app from '../../App';
import DbDAO from '../../db/DbDAO';
import { MessageProtocol } from '../../enums/Message';
import { UserRole } from '../../enums/UserRole';
import { QuizPoolModel } from '../../models/quiz/QuizPoolModelItem';
import { AuthService } from '../../services/AuthService';
import { staticStatistics } from '../../statistics';
import { generateQuiz } from '../fixtures';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';
const privateKey = Math.random().toString(10);

@suite
class QuizPoolApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/quizpool`;
  private _hashtag = hashtag;

  public async before(): Promise<void> {
    staticStatistics.pathToAssets = path.join(__dirname, '..', '..', '..', 'assets');
  }

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test @timeout(5000)
  public async getAvailablePoolQuestions(): Promise<void> {
    const res = await chai.request(app).post(`${this._baseApiRoute}/generate`).send({
      data: {
        tag: 'test-tag',
        amount: 1,
      },
    });
    expect(res.type).to.equal('application/json');
    expect(res.status).to.equal(200);
  }

  @test @timeout(5000)
  public async getAvailablePoolTags(): Promise<void> {
    const quiz = generateQuiz(this._hashtag);
    quiz.questionList[0].tags = ['test-tag'];
    const id = new ObjectId();
    await QuizPoolModel.create({ _id: id, approved: false, question: quiz.questionList[0] });

    const res = await chai.request(app).get(`${this._baseApiRoute}/tags`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test
  public async addNewPoolQuestion(): Promise<void> {
    const quiz = generateQuiz(this._hashtag);
    quiz.questionList[0].tags = ['test-tag'];
    const res = await chai.request(app).post(`${this._baseApiRoute}/`).send({
      question: quiz.questionList[0],
      notificationMail: ''
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Available);
  }

  @test
  public async getPendingPoolQuestions(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/pending`).set('authorization', AuthService.createToken({
      name: 'user',
      userAuthorizations: [UserRole.SuperAdmin],
    }));
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Available);
  }

  @test
  public async getPendingPoolQuestionById(): Promise<void> {
    const res = await chai.request(app).get(`${this._baseApiRoute}/pending/${new ObjectId()}`).set('authorization', AuthService.createToken({
      name: 'user',
      userAuthorizations: [UserRole.SuperAdmin],
    }));
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Available);
  }

  @test
  public async deletePoolQuestion(): Promise<void> {
    const res = await chai.request(app).del(`${this._baseApiRoute}/${new ObjectId()}`).set('authorization', AuthService.createToken({
      name: 'user',
      userAuthorizations: [UserRole.SuperAdmin],
    }));
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Removed);
  }

  @test
  public async approvePendingPoolQuestion(): Promise<void> {
    const quiz = generateQuiz(this._hashtag);
    quiz.questionList[0].tags = ['test-tag'];
    const id = new ObjectId();

    await QuizPoolModel.create({ _id: id, approved: false, question: quiz.questionList[0] });

    const res = await chai.request(app).put(`${this._baseApiRoute}/pending`).set('authorization', AuthService.createToken({
      name: 'user',
      userAuthorizations: [UserRole.SuperAdmin],
    })).send({
      id,
      question: quiz.questionList[0]
    });
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    expect(res.body.step).to.equal(MessageProtocol.Updated);
  }
}
