const path = require('path');

const defaults = {
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  module: {
    rules: [
      {
        test: /.tsx?$/,
        use: ["ts-loader"],
        exclude: /node_modules/
      },
      {
        test: /\.js?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.json']
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