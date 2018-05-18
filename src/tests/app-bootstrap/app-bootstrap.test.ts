/// <reference path="../../../node_modules/@types/chai-http/index.d.ts" />

import {suite, test} from 'mocha-typescript';
import {createDefaultPaths} from '../../app_bootstrap';

@suite class AppBootstrapRouterTestSuite {

  @test async ensureDefaultPathsExist() {
    createDefaultPaths();
  }
}
