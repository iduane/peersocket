import Provider from './provider';
import config from '../peersocket.config';

const provider = new Provider('localhost', config.port, 1, 'abc');
(async () => {
  await provider.connectToCentric();

  setTimeout(() => {
    for (let key in provider.peerConnections) {
      provider.send(key, 'nihaoa');
      break;
    }
  }, 15000);
})();
