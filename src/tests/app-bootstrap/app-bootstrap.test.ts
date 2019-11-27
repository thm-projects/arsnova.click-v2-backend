/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import { setGlobalOptions } from '@typegoose/typegoose';
import { suite, test } from 'mocha-typescript';

setGlobalOptions({
  globalOptions: {
    useNewEnum: true,
  },
});

@suite
class AppBootstrapRouterTestSuite {

  @test
  public async ensureDefaultPathsExist(): Promise<void> {
  }
}
