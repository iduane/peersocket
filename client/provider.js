import io from 'socket.io-client';
import defer from "../utils/defer";
import waitChannel from "../utils/wait-channel";
import debug from 'debug';
import config from '../peersocket.config.js';
import DataWrapper from "../utils/data-wrapper";
import stringifyObject from 'stringify-object';

import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'wrtc';

const log = debug('peersocket');

export default class Provider {
  constructor(host, port, providerId, authToken) {
    this.host = host;
    this.port = port;
    this.providerId = providerId;
    this.authToken = authToken;

    this.peerConnections = {};
    this.dataReceiptWaitingQueue = {};
  }

  async connectToCentric() {
    const {promise, resolve} = defer();

    const url = 'http://' + this.host + ':' + this.port;
    log('connect to centric server ' + url);

    this.socket = io.connect(url, {
      path: '/ntf-provider',
      secure: false,
      reconnect: false,
      rejectUnauthorized: false,
    });

    this.socket.on('connect', async () => {
      const response = await this.initialize();
      log('initialize result with response ' + response);
      resolve();
    });

    return promise;
  }

  async initialize() {
    this.socket.emit('initialize', {
      providerId: this.providerId,
      authToken: this.authToken,
    });

    this.socket.on('init-peer', (consumerId) => {
      log('receive peer connection initialize request from consumer[' + consumerId + ']');
      this.initPeerConnection(consumerId);
    });

    this.socket.on('exchange-ice', (wrappedData) => {
      log('receive ice candidate from consumer[' + wrappedData.consumerId + ']');
      this.onRemoteExchangeICE(wrappedData.consumerId, wrappedData.data);
    });

    this.socket.on('exchange-offer', (wrappedData) => {
      log('receive offer from consumer[' + wrappedData.consumerId + ']');
      this.onRemoteExchangeOffer(wrappedData.consumerId, wrappedData.data);
    });

    this.socket.on('consumer-disconnect', (wrappedData) => {
      log('receive centric disconnect event from consumer[' + wrappedData.consumerId + ']');
      // currently do nothing
      this.socket.emit('consumer-disconnect-response', wrappedData);
    });

    return await waitChannel(this.socket, 'initialize-response');
  }

  initPeerConnection(consumerId) {
    // FIXME: use a separated process to handle peer connection, since it not stable that may cause provide die
    if (this.peerConnections[consumerId]) {
      this.cleanupConsumer(consumerId);
    }

    const conn = new RTCPeerConnection();

    const consumer = this.peerConnections[consumerId] = {
      consumerId,
      peerConnection: conn,
      channelOpened: false,
      channel: null,
    };


    conn.onicecandidate = (e) => {
      if (!e.candidate) return;
      log('prepare ice candidate from consumer[' + consumerId + ']');
      this.exchangeICE(consumerId, e.candidate);
    };

    conn.ondatachannel = (e) => {
      consumer.channel = e.channel;
      consumer.channel.onopen = () => {
        log('open data channel for consumer[' + consumerId + ']');
        this.notifyChannelReady(consumerId);
        consumer.isChannelOpened = true;
      };

      consumer.channel.onmessage = (e) => {
        log('receive data from consumer[' + consumerId + ']');
        let data = e.data;
        if (data.indexOf('{') === 0) {
          data = JSON.parse(e.data);
        }
        // log(stringifyObject(data));
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
            this.cleanupConsumer(consumer.consumerId);
          }
        }
      };
    };

    this.socket.emit('init-peer-response', 'ok');
  }

  cleanupConsumer(consumerId) {
    log('cleanup consumer[' + consumerId + ']');
    const consumer = this.peerConnections[consumerId];

    if (consumer) {
      consumer.channel.close();
      consumer.peerConnection.close();
    }
    delete this.peerConnections[consumerId];
  }

  exchangeICE(consumerId, candidate) {
    log('send ice candidate from consumer[' + consumerId + ']');
    this.socket.emit('exchange-ice', new DataWrapper(
      consumerId,
      this.providerId,
      JSON.stringify(candidate)
    ));
  }

  exchangeAnswer(consumerId, answer) {
    log('send answer');
    this.socket.emit('exchange-answer', new DataWrapper(
      consumerId,
      this.providerId,
      answer
    ));
  }

  onRemoteExchangeICE(consumerId, candidate) {
    const consumer = this.peerConnections[consumerId];
    if (consumer) {
      log('add ice candidate from consumer[' + consumerId + ']');
      consumer.peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
    } else {
      log('have not initialize a peer connection for the consumer[' + consumerId + '] yet');
    }
  }

  onRemoteExchangeOffer(consumerId, remoteDesc) {
    const consumer = this.peerConnections[consumerId];
    if (consumer) {
      const conn = consumer.peerConnection;

      log('set remote description for consumer[' + consumerId + ']');
      conn.setRemoteDescription(
        new RTCSessionDescription(remoteDesc),

        () => {
          log('create answer for consumer[' + consumerId + ']');
          conn.createAnswer((localDesc) => {
            log('set local description for consumer[' + consumerId + ']');
            conn.setLocalDescription(
              new RTCSessionDescription(localDesc),
              () => {
                log('set local description for consumer[' + consumerId + '] successful');
                this.exchangeAnswer(consumerId, localDesc);
              },

              () => {
                log('fail to set local desc for the consumer[' + consumerId + ']');
              }
            )
          }, () => {
            log('fail to create answer for the consumer[' + consumerId + ']');
          });
        },

        () => {
          log('fail to set remote desc for the consumer[' + consumerId + ']');
        }
      );
    } else {
      log('have not initialize a peer connection for the consumer[' + consumerId + '] yet');
    }
  }

  notifyChannelReady(consumerId) {
    this.socket.emit('data-channel-ready', new DataWrapper(
      consumerId,
      this.providerId,
      1
    ));
  }

  send(consumerId, data) {
    const wrappedData = new DataWrapper(
      consumerId,
      this.providerId,
      data
    );
    const { promise, resolve, reject } = defer(config.receiptTimeout, () => {
      delete this.dataReceiptWaitingQueue[wrappedData.rid];
    });
    const consumer = this.peerConnections[consumerId];

    if (consumer.isChannelOpened) {
      consumer.channel.send(JSON.stringify(wrappedData));
      this.dataReceiptWaitingQueue[wrappedData.rid] = resolve;
    } else {
      log('data channel have not opened yet for consumer[' + consumerId + ']');
      reject(new Error('data channel not open'));
    }

    return promise;
  }

  onData(wrappedData) {
    const {rid, consumerId} = wrappedData;
    const consumer = this.peerConnections[consumerId];

    if (consumer.isChannelOpened) {
      // send receipt
      consumer.channel.send('op:receipt,payload:' + rid);
      // TODO: add handlers
    } else {
      log('data channel is closed for consumer[' + consumerId + ']');
    }
  }

  onDataReceipt(rid) {
    if (this.dataReceiptWaitingQueue[rid]) {
      this.dataReceiptWaitingQueue[rid]();
      delete this.dataReceiptWaitingQueue[rid];
    }
  }

  cleanup() {
    this.dataReceiptWaitingQueue = {};
  }
}
