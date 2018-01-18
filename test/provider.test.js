import { expect } from 'chai';
import { spawn } from 'child_process';
import path from 'path';
import Provider from '../src/provider';
import sleep from '../utils/sleep';
import config from '../peersocket.config';

describe('Provider', () => {
  let serverProcess;

  beforeEach(async () => {
    const serverPath = path.resolve(__dirname, '../server/index');
    serverProcess = spawn('node_modules/.bin/babel-client.cmd', [serverPath]);
    await sleep(1000);
  });

  afterEach(async () => {
    serverProcess.kill('SIGINT');
    await sleep(1000);
  });

  it('connect to server', async () => {
    const provider = new Provider('localhost', config.port, 1, 'abc');
    provider.start();
    await sleep(10000);
    expect(provider).to.be.exist;
  }).timeout(1000000);

});
