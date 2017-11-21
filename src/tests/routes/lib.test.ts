// Reference mocha-typescript's global definitions:
/// <reference path="../../../node_modules/mocha-typescript/globals.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import chaiHttp = require('chai-http');

import router from '../../App';
import {IQuestionGroup} from 'arsnova-click-v2-types/src/questions/interfaces';
import {staticStatistics} from '../../statistics';
import {QuizManagerDAO} from '../../db/QuizManagerDAO';

chai.use(chaiHttp);
const expect = chai.expect;

const hashtag = 'mocha-test-lib';

@suite class LibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib`;

  @test async baseApiExists() {
    const res = await chai.request(router).get(`${this._baseApiRoute}`);
    expect(res.type).to.eql('application/json');
  }

  /*
  This Test will fail or not fail depending if the backend has been able to generate the frontend favicons before
   */
  @test.skip
  async faviconExists() {
    const res = await chai.request(router).get(`${this._baseApiRoute}/favicon`);
    expect(res.type).to.eql('image/png');
  }
}

@suite class MathjaxLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/mathjax`;

  @test async mathjaxExists() {
    const res = await chai.request(router).post(`${this._baseApiRoute}`).send({
      mathjax: JSON.stringify('\\begin{align} a_1& =b_1+c_1/\\\\ a_2& =b_2+c_2-d_2+e_2 /\\end{align}'),
      format: 'TeX',
      output: 'svg'
    });
    expect(res.type).to.eql('text/html');
  }

  @test async mathjaxExampleFirstExists() {
    const res = await chai.request(router).get(`${this._baseApiRoute}/example/first`);
    expect(res.type).to.eql('application/json');
  }

  @test async mathjaxExampleSecondExists() {
    const res = await chai.request(router).get(`${this._baseApiRoute}/example/second`);
    expect(res.type).to.eql('application/json');
  }

  @test async mathjaxExampleThirdExists() {
    const res = await chai.request(router).get(`${this._baseApiRoute}/example/third`);
    expect(res.type).to.eql('text/html');
  }
}

@suite class CacheQuizAssetsLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/cache/quiz/assets`;
  private _hashtag = hashtag;
  private _quiz: IQuestionGroup = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')
  ).toString('UTF-8'));

  static before() {
    QuizManagerDAO.initInactiveQuiz(hashtag);
  }

  static after() {
    QuizManagerDAO.removeQuiz(hashtag);
  }

  @test async postNewAssetExists() {
    this._quiz.hashtag = this._hashtag;
    const res = await chai.request(router).post(`${this._baseApiRoute}/`).send({quiz: this._quiz});
    expect(res.type).to.eql('application/json');
  }

  @test async quizWithAssetUrlsExists() {
    this._quiz.hashtag = this._hashtag;
    const parsedQuiz: IQuestionGroup = QuizManagerDAO.initActiveQuiz(this._quiz).originalObject;
    expect(parsedQuiz.questionList.map(question => question.questionText).filter(
      questionText => questionText.indexOf(staticStatistics.rewriteAssetCacheUrl) > -1).length
    ).to.be.greaterThan(0, 'Expect to find the rewritten assets cache url');
  }

  @test async getByDigestExists() {
    const res = await chai.request(router).get(`${this._baseApiRoute}/7b354ef246ea570c0cc360c1eb2bda4061aec31d1012b2011077de11b9b28898`);
    expect(res.type).to.eql('text/html');
  }
}

@suite class AuthorizeLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/authorize`;

  @test async authorizeExists() {
    const res = await chai.request(router)
      .get(`${this._baseApiRoute}`)
      .set('referer', staticStatistics.rewriteAssetCacheUrl);
    expect(res.type).to.eql('text/html');
  }
}
