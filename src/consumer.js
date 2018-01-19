import io from 'socket.io-client';
import defer from '../utils/defer';
import waitChannel from '../utils/wait-channel';
import DataWrapper from '../utils/data-wrapper';
import debug from 'debug';
import config from '../peersocket.config.js';

const log = debug('peersocket:consumer');

export default class Consumer {
  constructor(brokerUrl, providerId) {
    this.brokerUrl = brokerUrl;
    this.providerId = providerId;

    this.socket = null;
    this.id = null;
    this.peerConnection = null;
    this.channel = null;
    this.isChannelOpened = -1;
    this.channelReadyResolver = null;

    this.dataReceiptWaitingQueue = {};
    this.willClose = false;

    this.dataListener = null;
  }

  async connectToCentric() {
    return await this.connect();
  }

  closeCentricConnection() {
    if (this.socket) {
      log('close the connection to centric server');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  connect() {
    const { promise, resolve, reject } = defer();
    log('connect to centric server ' + this.brokerUrl);

    this.socket = io.connect(this.brokerUrl, {
      path: '/ntf',
      secure: false,
      reconnect: false,
      rejectUnauthorized: false,
    });

    this.socket.on('connect', async () => {
      const response = await this.initialize();
      this.id = this.socket.id;
      log('initialize result with response ' + response);
      resolve(response);
    });

    this.socket.on('exchange-ice', (wrappedData) => {
      log('receive remote ice candidate');
      this.onRemoteExchangeICE(wrappedData.data);
    });

    this.socket.on('exchange-answer', (wrappedData) => {
      log('receive answer');
      this.onRemoteExchangeAnswer(wrappedData.data);
    });

    this.socket.on('data-channel-ready', (wrappedData) => {
      log('receive remote data channel ready notification');
      this.onChannelReady();
    });

    this.socket.on('will-close', (reason) => {
      log('remote will termiate this session with reason: ' + reason);
      this.willClose = true;
    });

    this.socket.on('disconnect', () => {
      if (this.willClose) {
        this.termiate();
        reject(new Error('remote close this session'));
      }
    });

    return promise;
  }

  async initialize() {
    this.socket.emit('initialize', {
      providerId: this.providerId,
    });

    return await waitChannel(this.socket, 'initialize-response');
  }

  connectToPeer() {
    const { promise, resolve, reject } = defer();

    this.channelReadyResolver = resolve;

    log('create peer connection');
    const conn = new this.wrtc.RTCPeerConnection();
    this.peerConnection = conn;

    conn.onicecandidate = (e) => {
      if(!e.candidate) return;
      log('prepare local ice candidate');
      this.exchangeICE(e.candidate);
    };

    this.channel = conn.createDataChannel('peersocket', {
      ordered: true,
    });
    // channel.binnaryType = 'arraybuffer';

    this.channel.onopen = () => {
      log('peer data channel opened');
      this.onChannelReady();
    };

    this.channel.onclose = () => {
      log('data channel closed');
      this.cleanup();
    };

    this.channel.onmessage = (e) => {
      let data = e.data;
      if (data.indexOf('{') === 0) {
        data = JSON.parse(e.data);
      }

      if (data.rid) {
        this.onData(data);
      } else if (typeof data === 'string') {
        const intent = data.split(',').reduce((map, item) => {
          const [key, value] = item.split(':');
          map[key] = value;
          return map;
        }, {})
        if (intent.op === 'receipt') {
          this.onDataReceipt(intent.payload);
        } else if (intent.op === 'close') {
          this.cleanup();
        }
      }
    };

    conn.createOffer((localDesc) => {
      conn.setLocalDescription(
        new this.wrtc.RTCSessionDescription(localDesc),

        () => {
          this.exchangeOffer(localDesc);
        },

        () => {
          log('consumer[' + this.id + '] fail to set local description.');
          reject();
        }
      );
    }, () => {
      log('consumer[' + this.id + '] fail to create offer.');
      reject();
    });

    return promise;
  }

  exchangeICE(candidate) {
    log('send ice candidate');
    this.socket.emit('exchange-ice', new DataWrapper(
      this.id,
      this.providerId,
      JSON.stringify(candidate)
    ));
  }

  onRemoteExchangeICE(candidate) {
    log('add remote ice candidate');
    this.peerConnection.addIceCandidate(new this.wrtc.RTCIceCandidate(JSON.parse(candidate)));
  }

  exchangeOffer(localDesc) {
    log('send offer');
    this.socket.emit('exchange-offer', new DataWrapper(
      this.id,
      this.providerId,
      localDesc
    ));
  }

  onRemoteExchangeAnswer(remoteDesc) {
    const conn = this.peerConnection;

    log('set remote description');
    conn.setRemoteDescription(
      new this.wrtc.RTCSessionDescription(remoteDesc),

      () => {
        log('peer connected');
      },

      () => {
        log('fail to set remote desc.');
        reject();
      }
    );
  }

  onChannelReady() {
    this.isChannelOpened += 1;

    if (this.isChannelOpened) {
      log('data channel is ready');
      this.onDataChannelConnected();
    }
  }

  onDataChannelConnected() {
    if (this.channelReadyResolver) {
      setTimeout(() => {
        this.channelReadyResolver();
        this.channelReadyResolver = null;
      }, 100);
      log('disconnect from centric server since data channel connected');
      this.socket.disconnect();
    }
  }

  send(data) {
    log('send data');
    const wrappedData = new DataWrapper(
      this.id,
      this.providerId,
      data
    );
    const { promise, resolve, reject } = defer(config.receiptTimeout, () => {
      delete this.dataReceiptWaitingQueue[wrappedData.rid];
    });
    if (this.isChannelOpened) {
      this.channel.send(JSON.stringify(wrappedData));
      this.dataReceiptWaitingQueue[wrappedData.rid] = { resolve, reject };
    } else {
      log('data channel have not opened yet.');
      reject(new Error('data channel not open'));
    }

    return promise;
  }

  onData(wrappedData) {
    log('receive data from provider');

    const {rid, consumerId} = wrappedData;

    if (this.isChannelOpened) {
      // send receipt
      this.channel.send('op:receipt,payload:' + rid);
      log('send data receipt to provider');
      if (this.dataListener) {
        this.dataListener(wrappedData.data);
      }

    } else {
      log('data channel is not ready yet');
    }
  }

  pipeData(dataListener) {
    this.dataListener = dataListener;
  }

  onDataReceipt(rid) {
    log('receive data receipt');
    if (this.dataReceiptWaitingQueue[rid]) {
      this.dataReceiptWaitingQueue[rid].resolve();
      delete this.dataReceiptWaitingQueue[rid];
    }
  }

  onCloseDataChannel() {
    this.send('op:close');

    this.cleanup();
  }
  
  termiate() {
    this.cleanup();
  }

  cleanup() {
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.isChannelOpened = -1;
    for (let rid in this.dataReceiptWaitingQueue) {
      this.dataReceiptWaitingQueue[rid].resolve();
    }
    this.dataReceiptWaitingQueue = {};
    this.willClose = false;

    this.dataListener = null;
  }
}
