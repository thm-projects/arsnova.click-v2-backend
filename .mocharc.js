'use strict';

module.exports = {
  diff: true,
  extension: ['ts', 'js'],
  opts: false,
  exit: true,
  package: './package.json',
  spec: "src/**/*.test.ts",
  reporter: 'spec',
  slow: 75,
  timeout: 60000,
  recursive: true,
  require: ["ts-node/register", "source-map-support/register", "src/tests/mongo-mock.ts"],
  'watch-files': ['src/**/*.ts'],
};
