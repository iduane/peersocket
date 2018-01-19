const path = require('path');
const pkg = require('./package.json');
const MinifyPlugin = require("babel-minify-webpack-plugin");
// const nodeExternals = require('webpack-node-externals');

module.exports =  {
  entry: {
    client: './web/index',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `${pkg.name}.[name].js`,
    libraryTarget: "window",
    library: "peersocket",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            "presets": ["env"],
            "plugins": [
              ["transform-runtime", {
                "helpers": false,
                "polyfill": false,
                "regenerator": true,
                "moduleName": "babel-runtime"
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new MinifyPlugin({}, {})
  ],
  // externals: ['wrtc'],
};
