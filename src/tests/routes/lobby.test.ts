// Reference mocha-typescript's global definitions:
/// <reference path="../../../node_modules/mocha-typescript/globals.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as WebSocket from 'ws';

import app from '../../App';
import {IQuestionGroup} from 'arsnova-click-v2-types/src/questions/interfaces';
import {staticStatistics} from '../../statistics';
import {QuizManagerDAO} from '../../db/QuizManagerDAO';
import {WebSocketRouter} from '../../routes/websocket';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-api-v1';

@suite class LobbyApiRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/api/v1/lobby`;
  private _hashtag = hashtag;

  static before() {
    QuizManagerDAO.initInactiveQuiz(hashtag);
    WebSocketRouter.wss = new WebSocket.Server({port: staticStatistics.port});
  }

  static after() {
    QuizManagerDAO.removeQuiz(hashtag);
    WebSocketRouter.wss.close();
  }

  @test async baseApiExists() {
    const res = await chai.request(app).get(`${this._baseApiRoute}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async putOpenLobby() {
    const quiz: IQuestionGroup = JSON.parse(fs.readFileSync(
      path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')
    ).toString('UTF-8'));
    quiz.hashtag = this._hashtag;
    const res = await chai.request(app).put(`${this._baseApiRoute}/`).send({quiz});
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    await expect(QuizManagerDAO.isActiveQuiz(this._hashtag)).to.be.true;
  }

  @test async getLobbyData() {
    const res = await chai.request(app).get(`${this._baseApiRoute}/${this._hashtag}`);
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
  }

  @test async putCloseLobby() {
    const res = await chai.request(app).del(`${this._baseApiRoute}/`).send({quizName: this._hashtag});
    expect(res.status).to.equal(200);
    expect(res.type).to.equal('application/json');
    await expect(QuizManagerDAO.isInactiveQuiz(this._hashtag)).to.be.true;
  }
}
