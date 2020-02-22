/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import { setGlobalOptions } from '@typegoose/typegoose';
import { suite, test } from 'mocha-typescript';
import * as mongoUnit from 'mongo-unit';

setGlobalOptions({
  globalOptions: {
    useNewEnum: true,
  },
});

@suite
class AppBootstrapRouterTestSuite {

  public static async before(): Promise<void> {
    return mongoUnit.initDb(process.env.MONGODB_CONN_URL, []);
  }

  public async after(): Promise<void> {
    return mongoUnit.drop();
  }

  @test
  public async ensureDefaultPathsExist(): Promise<void> {
  }
}
