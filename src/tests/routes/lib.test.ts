/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import * as chai from 'chai';
import * as fs from 'fs';
import { suite, test } from 'mocha-typescript';
import * as path from 'path';

import router from '../../App';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { staticStatistics } from '../../statistics';

chai.use(require('chai-http'));
const expect = chai.expect;

const hashtag = 'mocha-test-lib';

@suite
class LibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib`;

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}`);
    expect(res.type).to.eql('application/json');
  }

  /*
   This Test will fail or not fail depending if the backend has been able to generate the frontend favicons before
   */
  @test
  public async faviconExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/favicon`);
    expect(res.type).to.eql('image/png');
  }
}

@suite
class MathjaxLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/mathjax`;

  @test
  public async mathjaxExists(): Promise<void> {
    const res = await chai.request(router).post(`${this._baseApiRoute}`).send({
      mathjax: JSON.stringify('\\begin a_1 = b_1 + c_1 a_2 = b_2 + c_2 - d_2 + e_2 \\end'),
      format: 'TeX',
      output: 'svg',
    });
    expect(res.type).to.eql('text/html');
  }

  @test
  public async mathjaxExampleFirstExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/example/first`);
    expect(res.type).to.eql('application/json');
  }

  @test
  public async mathjaxExampleSecondExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/example/second`);
    expect(res.type).to.eql('application/json');
  }

  @test
  public async mathjaxExampleThirdExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/example/third`);
    expect(res.type).to.eql('text/html');
  }
}

@suite
class CacheQuizAssetsLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/cache/quiz/assets`;
  private _hashtag = hashtag;
  private _quiz: IQuestionGroup = JSON.parse(
    fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));

  public static before(): void {
    QuizManagerDAO.initInactiveQuiz(hashtag);
  }

  public static after(): void {
    QuizManagerDAO.removeQuiz(hashtag);
  }

  @test
  public async postNewAssetExists(): Promise<void> {
    this._quiz.hashtag = this._hashtag;
    const res = await chai.request(router).post(`${this._baseApiRoute}/`).send({ quiz: this._quiz });
    expect(res.type).to.eql('application/json');
  }

  @test.skip
  public async quizWithAssetUrlsExists(): Promise<void> {
    this._quiz.hashtag = this._hashtag;
    const parsedQuiz: IQuestionGroup = QuizManagerDAO.initActiveQuiz(this._quiz).originalObject;
    expect(parsedQuiz.questionList.map(question => question.questionText)
    .filter(questionText => questionText.indexOf(staticStatistics.rewriteAssetCacheUrl) > -1).length).to.be
    .greaterThan(0, 'Expect to find the rewritten assets storage url');
  }

  @test
  public async getByDigestExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/7b354ef246ea570c0cc360c1eb2bda4061aec31d1012b2011077de11b9b28898`);
    expect(res.type).to.eql('text/html');
  }
}

@suite
class AuthorizeLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/authorize`;

  @test
  public async authorizeExists(): Promise<void> {
    const res = await chai.request(router)
    .get(`${this._baseApiRoute}`)
    .set('referer', staticStatistics.rewriteAssetCacheUrl);
    expect(res.type).to.eql('text/html');
  }

  @test
  public async authorizeStaticExists(): Promise<void> {
    const res = await chai.request(router)
    .post(`${this._baseApiRoute}/static`).send({
      username: 'testuser',
      passwordHash: 'testpasshash',
    });
    expect(res.type).to.eql('application/json');
  }

  @test
  public async validateTokenExists(): Promise<void> {
    const res = await chai.request(router)
    .get(`${this._baseApiRoute}/validate/testuser/testToken`);
    expect(res.type).to.eql('application/json');
  }
}
