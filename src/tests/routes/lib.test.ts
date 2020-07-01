/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as chai from 'chai';
import { slow, suite, test } from 'mocha-typescript';
import * as puppeteer from 'puppeteer';
import * as sinon from 'sinon';
import router from '../../App';
import DbDAO from '../../db/DbDAO';
import UserDAO from '../../db/UserDAO';
import { AssetModel } from '../../models/AssetModel';
import { settings } from '../../statistics';

chai.use(require('chai-http'));
const expect = chai.expect;

const hashtag = 'mocha-test-lib';
const privateKey = Math.random().toString(10);

@suite
class LibRouterTestSuite {
  private _baseApiRoute = `${settings.routePrefix}/api/lib`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async baseApiExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}`);
    expect(res.type).to.eql('application/json');
  }

  @test
  public async renderImageExists(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(puppeteer, 'launch').value(() => new Promise(resolve => resolve({
      newPage: () => new Promise(resolve2 => resolve2({
        setViewport: () => new Promise(resolve1 => resolve1()),
        setContent: () => new Promise(resolve1 => resolve1()),
        addStyleTag: () => new Promise(resolve1 => resolve1()),
        screenshot: () => new Promise(resolve1 => resolve1(Buffer.from([1]))),
      })),
      close: () => new Promise(resolve1 => resolve1()),
    })));

    const res = await chai.request(router).post(`${this._baseApiRoute}/image/quiz`).send({
      html: '<div></div>',
      theme: 'Material',
    });
    expect(res.body).to.eql('2c862f8f719d6bf6e2ba5ecd7ea9a39ade6b4eb18a10524aa27773a676de445a');

    sandbox.restore();
  }
}

@suite
class MathjaxLibRouterTestSuite {
  private _baseApiRoute = `${settings.routePrefix}/api/lib/mathjax`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async mathjaxExists(): Promise<void> {
    const mathjax = [
      `
      $$
      \\begin{matrix}
      1 & 2 & 3 \\\\
      4 & 5 & 6 \\\\
      7 & 8 & 9
      \\end{matrix}
      $$
    `,
    ];
    const res = await chai.request(router).post(`${this._baseApiRoute}`).send({
      mathjax: JSON.stringify(mathjax),
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
  private _baseApiRoute = `${settings.routePrefix}/api/lib/cache/quiz/assets`;

  public async before(): Promise<void> {
    await AssetModel.create({
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375.jpg/620px-Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375.jpg',
      digest: 'e5cf0e52c29860e10b80617d794e5aee0f6620701ab487591881e6635f142ef0',
      mimeType: 'image/jpeg',
      data: Buffer.from([1]),
    } as any);
  }

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test @slow(5000)
  public async getByDigestExists(): Promise<void> {
    const res = await chai.request(router).get(`${this._baseApiRoute}/e5cf0e52c29860e10b80617d794e5aee0f6620701ab487591881e6635f142ef0`);
    expect(res.type).to.eql('image/jpeg');
  }
}

@suite
class AuthorizeLibRouterTestSuite {
  private _baseApiRoute = `${settings.routePrefix}/api/lib/authorize`;

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async authorizeStaticExists(): Promise<void> {
    await UserDAO.addUser({
      name: 'testuser',
      passwordHash: 'testpasshash',
      userAuthorizations: [],
      privateKey: 'privateKey',
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
