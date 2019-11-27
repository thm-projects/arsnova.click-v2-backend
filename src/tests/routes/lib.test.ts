/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import * as fs from 'fs';
import { slow, suite, test } from 'mocha-typescript';
import * as path from 'path';
import * as sinon from 'sinon';

import router from '../../App';
import AMQPConnector from '../../db/AMQPConnector';
import MongoDBConnector from '../../db/MongoDBConnector';
import QuizDAO from '../../db/quiz/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { IUserSerialized } from '../../interfaces/users/IUserSerialized';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import { staticStatistics } from '../../statistics';

require('../../lib/regExpEscape'); // Installing polyfill for RegExp.escape

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
}

@suite
class MathjaxLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/mathjax`;

  @test
  public async mathjaxExists(): Promise<void> {
    const res = await chai.request(router).post(`${this._baseApiRoute}`).send({
      mathjax: JSON.stringify(`\\begin{align} a_1& =b_1+c_1\\\\ a_2& =b_2+c_2-d_2+e_2 \\end{align}`),
      format: 'TeX',
      output: 'svg',
    });
    expect(res.type).to.eql('application/json');
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
    expect(res.type).to.eql('image/svg+xml');
  }
}

@suite
class CacheQuizAssetsLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/cache/quiz/assets`;
  private _hashtag = hashtag;
  private _quiz: IQuiz = JSON.parse(
    fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));

  public async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(AMQPConnector, 'channel').value({ assertExchange: () => {} });
    sandbox.stub(MongoDBConnector, 'connect').value({ assertExchange: () => {} });

    this._quiz.name = this._hashtag;
    const doc = await QuizDAO.addQuiz(this._quiz);
    await QuizDAO.initQuiz(doc);

    sandbox.restore();
  }

  public async after(): Promise<void> {
    await QuizDAO.removeQuiz((await QuizDAO.getQuizByName(hashtag)).id);
  }

  @test @slow(5000)
  public async postNewAssetExists(): Promise<void> {
    const res = await chai.request(router).post(`${this._baseApiRoute}/`).send({ quiz: this._quiz });
    expect(res.type).to.eql('application/json');
  }

  @test.skip
  public async quizWithAssetUrlsExists(): Promise<void> {
    const parsedQuiz: QuizModelItem = await QuizDAO.getQuizByName(this._hashtag);

    expect(parsedQuiz.questionList.map(question => question.questionText)
    .filter(questionText => questionText.indexOf(staticStatistics.rewriteAssetCacheUrl) > -1).length).to.be
    .greaterThan(0, 'Expect to find the rewritten assets storage url');
  }

  @test @slow(5000)
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
    await UserDAO.addUser({
      name: 'testuser',
      passwordHash: 'testpasshash',
    } as IUserSerialized);
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
