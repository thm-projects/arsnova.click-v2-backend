const base = require("./webpack.base.config");
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const GenerateJsonPlugin = require('generate-json-webpack-plugin');

const path = require('path');

const devPackagejson = require('./package');
delete devPackagejson.devDependencies;
delete devPackagejson.scripts;

devPackagejson.scripts = {'start': 'node server.js'};

const buildInfoJson = require('./build');
const newBuild = parseInt(buildInfoJson.build, 10) + 1;
const buildInfo = Object.assign(buildInfoJson, {
  build: newBuild,
  version: `${buildInfoJson.major}.${buildInfoJson.minor}.${newBuild}`,
  timestamp: new Date().getTime()
});

const config = {
  externals: [nodeExternals({
    whitelist: ['webpack/hot/poll?1000']
  })],
  plugins: [
    new webpack.NamedModulesPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      "process.env": {
        "BUILD_TARGET": JSON.stringify('server')
      }
    }),
    new GenerateJsonPlugin('package.json', devPackagejson),
    new GenerateJsonPlugin('build.json', buildInfo),
    new GenerateJsonPlugin(path.join('..', 'build.json'), buildInfo),
    new CopyWebpackPlugin([
      { from: 'assets', to: 'assets' }
    ]),
    new CopyWebpackPlugin([
      { from: 'jobs', to: 'jobs' }
    ]),
  ],
};

module.exports = base.extend(config);