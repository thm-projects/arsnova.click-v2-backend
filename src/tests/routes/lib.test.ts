/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { slow, suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';
import * as sinon from 'sinon';
import router from '../../App';
import AMQPConnector from '../../db/AMQPConnector';
import UserDAO from '../../db/UserDAO';
import { staticStatistics } from '../../statistics';

chai.use(require('chai-http'));
const expect = chai.expect;

const hashtag = 'mocha-test-lib';
const privateKey = Math.random().toString(10);

@suite
class LibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib`;

  public static async before(): Promise<void> {
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}`);
    expect(res.type).to.eql('application/json');
  }

  @test
  public async renderImageExists(): Promise<void> {
    const res = await chai.request(router).post(`${this._baseApiRoute}/image/quiz`).send({
      html: '<div></div>',
      theme: 'Material',
    });
    expect(res.body).to.eql('2c862f8f719d6bf6e2ba5ecd7ea9a39ade6b4eb18a10524aa27773a676de445a');
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

  public static async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(AMQPConnector, 'channel').value({ assertExchange: () => {} });
    await mongoUnit.initDb(process.env.MONGODB_CONN_URL, {
      assets: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375.jpg/620px-Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375.jpg',
          digest: 'e5cf0e52c29860e10b80617d794e5aee0f6620701ab487591881e6635f142ef0',
          mimeType: 'image/jpeg',
          data: Buffer.from([]),
        },
      ],
    });
    sandbox.restore();
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
  }

  @test @slow(5000)
  public async getByDigestExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/e5cf0e52c29860e10b80617d794e5aee0f6620701ab487591881e6635f142ef0`);
    expect(res.type).to.eql('image/jpeg');
  }
}

@suite
class AuthorizeLibRouterTestSuite {
  private _baseApiRoute = `${staticStatistics.routePrefix}/lib/authorize`;

  @test
  public async authorizeStaticExists(): Promise<void> {
    await UserDAO.addUser({
      name: 'testuser',
      passwordHash: 'testpasshash',
      userAuthorizations: [],
      privateKey: 'privateKey',
      tokenHash: 'tokenHash',
    });
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
