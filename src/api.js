import EventEmitter from 'eventemitter3';
import Consumer from './consumer';
import Provider from './provider';
import config from "../peersocket.config";
import defer from '../utils/defer';

async function initSeed(wrtc, brokerUrl, id, authToken) {
  Provider.prototype.wrtc = wrtc;
  const provider = new Provider(brokerUrl, id, authToken);

  await provider.connectToCentric();

  return provider;
}

async function initPeer(wrtc, brokerUrl, targetId) {
  Consumer.prototype.wrtc = wrtc;
  const consumer = new Consumer(brokerUrl, targetId);

  await consumer.connectToCentric();
  await consumer.connectToPeer();

  return consumer;
}



class proto extends EventEmitter {
  constructor() {
    super();
  }

  waitEventOnce(eventName) {
    const { promise, resolve, reject } = defer();
    this.once(eventName, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
    return promise;
  }

  close() {
    this.removeAllListeners();
  }
}

class seed extends proto {
  /**
   * @constructor
   * @param {string} brokerUrl Broker service url for signal
   * @param {string} id
   * @param {string} authToken
   */
  constructor(brokerUrl, id, authToken) {
    super();

    this.brokerUrl = brokerUrl;
    this.id = id;
    this.authToken = authToken;

    this.init();
  }

  async init() {
    this.provider = await initSeed(this.wrtc, this.brokerUrl, this.id, this.authToken);
    this.emit('registered');

    this.provider.pipeData((data) => this.emit('data', null, data));
  }

  send(peerId, data) {
    if (this.provider) {
      return this.provider.send(peerId, data);
    } else {
      throw new Error('seed not initialized yet');
    }
  }

  close() {
    super.close();

    if (this.provider) {
      this.provider.terminate();
    }
  }
}

class peer extends proto {
  constructor(brokerUrl, targetId) {
    super();

    this.id = '';

    this.brokerUrl = brokerUrl;
    this.targetId = targetId;

    this.init();
  }

  async init() {
    this.consumer = await initPeer(this.wrtc, this.brokerUrl, this.targetId);
    this.id = this.consumer.id;
    this.emit('connected');

    this.consumer.pipeData((data) => this.emit('data', null, data));
  }

  send(data) {
    if (this.consumer) {
      return this.consumer.send(data);
    } else {
      throw new Error('peer not initialized yet');
    }
  }

  close() {
    super.close();

    if (this.consumer) {
      this.consumer.terminate();
    }
  }
}

export default { seed, peer };
