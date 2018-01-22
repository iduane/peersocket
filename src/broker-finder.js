import conf from '../peersocket.config';
import request from 'request';
import fs from 'fs';
import path from 'path';
import os from 'os';
import defer from '../utils/defer';

export default () => {
  const { promise, resolve, reject } = defer();
  const { brokerRef } = conf;

  let brokerUrl;
  const localCachePath = path.resolve(os.homedir(), '.peersocket-server-address');
  if (fs.existsSync(localCachePath)) {
    brokerUrl = fs.readFileSync(localCachePath, 'utf8');
    resolve(brokerUrl);
  } else {
    request(brokerRef, (error, res, data) => {
      if (error) {
        reject('no public broker');
        return;
      }
      brokerUrl = data.split('\n')[0];
      fs.writeFileSync(localCachePath, brokerUrl, 'utf8');
      resolve(brokerUrl);
    })
  }

  return promise;
}

