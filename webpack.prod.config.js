const base = require("./webpack.base.config");
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin');

const config = {
  entry: [
    'webpack/hot/poll?1000',
    './src/main.ts'
  ],
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
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      },
      ARSNOVA_CLICK_BACKEND_PORT_INTERNAL: process.env.ARSNOVA_CLICK_BACKEND_PORT_INTERNAL,
      ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL: process.env.ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL,
      ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX: process.env.ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX,
      ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL: process.env.ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL,
      ARSNOVA_CLICK_BACKEND_SMTP_HOST: process.env.ARSNOVA_CLICK_BACKEND_SMTP_HOST,
      ARSNOVA_CLICK_BACKEND_SMTP_USERNAME: process.env.ARSNOVA_CLICK_BACKEND_SMTP_USERNAME,
      ARSNOVA_CLICK_BACKEND_SMTP_PASSWORD: process.env.ARSNOVA_CLICK_BACKEND_SMTP_PASSWORD,
      ARSNOVA_CLICK_BACKEND_SMTP_PORT: +process.env.ARSNOVA_CLICK_BACKEND_SMTP_PORT,
      ARSNOVA_CLICK_BACKEND_MAIL_FROM: process.env.ARSNOVA_CLICK_BACKEND_MAIL_FROM,
      ARSNOVA_CLICK_BACKEND_MAIL_TO: process.env.ARSNOVA_CLICK_BACKEND_MAIL_TO,
    }),
    new CopyWebpackPlugin([
      {from: 'assets', to: 'assets'}
    ]),
    new CopyWebpackPlugin([
      {from: 'jobs', to: 'jobs'}
    ]),
  ],
};

//config.plugins.push(new WebpackShellPlugin({onBuildEnd: ['node dist/main.js --inspect=9229 --inspect-brk dist/main.js']}));

module.exports = base.extend(config);