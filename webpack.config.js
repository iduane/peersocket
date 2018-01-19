const path = require('path');
const pkg = require('./package.json');
const nodeExternals = require('webpack-node-externals');

module.exports =  {
  entry: {
    client: './src/index',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `${pkg.name}.[name].js`,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components|web)/,
        use: {
          loader: 'babel-loader',
          options: {
            "presets": ["env"]
          }
        }
      }
    ]
  },
  externals: ['wrtc']
};
