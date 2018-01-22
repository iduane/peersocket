// Karma configuration
// Generated on Sat Jan 20 2018 02:03:09 GMT-0500 (EST)
process.env.CHROME_BIN = require('puppeteer').executablePath();

import os from 'os';
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

const localCachePath = path.resolve(os.homedir(), '.peersocket-server-address');
let brokerUrl = 'http://localhost:13799';
if (fs.existsSync(localCachePath)) {
  brokerUrl = fs.readFileSync(localCachePath, 'utf8');
}

const webpackConfig = require('./webpack.config.js');
// webpackConfig.entry = {};
webpackConfig.plugins = [
  new webpack.DefinePlugin({
    BROKER_URL: JSON.stringify(brokerUrl)
  })
];


module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha'],


    // list of files / patterns to load in the browser
    files: [
      'webtest/**/*.web.js'
    ],


    // list of files / patterns to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
        './webtest/**/*.test.web.js': ['webpack']
    },

    webpack: webpackConfig,

    webpackMiddleware: {
      noInfo: true
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['ChromeHeadless'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
}
