const path = require('path');

const defaults = {
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  mode: 'none',
  // this makes sure we include node_modules and other 3rd party libraries
  externals: [/node_modules/],
  module: {
    rules: [
      {
        test: /.tsx?$/,
        loader: 'ts-loader',
        options: { allowTsInNodeModules: true }
      },
      {
        test: /\.js?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.js', '.tsx', '.ts', '.json']
  },
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: 'dist',
    filename: '[name].js'
  }
};

module.exports.defaults = defaults;

module.exports.extend = function merge(config) {
  return Object.assign({}, defaults, config);
};

module.exports.merge = function merge(config) {
  return [].concat(defaults, config);
};