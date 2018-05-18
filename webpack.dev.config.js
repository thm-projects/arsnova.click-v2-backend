const base = require("./webpack.base.config");
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin');

const config = {
  devServer: {
    port: 3000,
    inline: true,
    hot: true,
    contentBase: '/dist',
    watchContentBase: true
  },
  externals: [nodeExternals({
    whitelist: ['webpack/hot/poll?1000']
  })],
  devtool: 'source-map',
  plugins: [
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      "process.env": {
        "BUILD_TARGET": JSON.stringify('server')
      }
    }),
    new CopyWebpackPlugin([
      { from: 'assets', to: 'assets' }
    ]),
    new CopyWebpackPlugin([
      { from: 'jobs', to: 'jobs' }
    ]),
  ],
};

//config.plugins.push(new WebpackShellPlugin({onBuildEnd: ['node dist/main.js --inspect=9229 --inspect-brk dist/main.js']}));

module.exports = base.extend(config);