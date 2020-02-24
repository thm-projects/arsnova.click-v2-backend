/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import { suite, test } from 'mocha-typescript';
import DbDAO from '../../db/DbDAO';

@suite
class AppBootstrapRouterTestSuite {

  public async after(): Promise<void> {
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async ensureDefaultPathsExist(): Promise<void> {
  }
}
