const path = require('path');
const pkg = require('./package.json');
const nodeExternals = require('webpack-node-externals');

module.exports = [
//   {
//   entry: {
//     'web.client': './web/consumer',
//   },
//   output: {
//     path: path.resolve(__dirname, 'dist'),
//     filename: `${pkg.name}.[name].js`,
//     libraryTarget: 'window'
//   },
//   module: {
//     rules: [
//       {
//         test: /\.js$/,
//         exclude: /(node_modules|bower_components|client|server|test)/,
//         use: {
//           loader: 'babel-loader',
//           options: {
//             presets: ['env']
//           }
//         }
//       }
//     ]
//   }
// },
  {
  entry: {
    'node.consumer': './client/consumer',
    'node.provider': './client/provider',
    server: './server/index',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `${pkg.name}.[name].js`,
    libraryTarget: 'commonjs'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components|web)/,
        use: {
          loader: 'babel-loader',
          options: {
            "presets": [
              ["env", {
                "targets": {
                  "node": "6.1.0"
                }
              }]
            ]
          }
        }
      }
    ]
  },
  target: 'node',
  externals: [nodeExternals()]
}];
