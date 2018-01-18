import Consumer from './consumer';
import config from '../peersocket.config';

const consumer = new Consumer('localhost', config.port, 1, 'abc');
(async () => {
  try {
    await consumer.connectToCentric();
    await consumer.connectToPeer();

    await consumer.send('hello');
    // consumer.termiate();
  } catch (e) {}
})();
