// PeerSocket Server (used to exchange peer data during setup)

import http from 'http';
import io from 'socket.io';
import { setTimeout, clearTimeout } from 'timers';
import debug from 'debug';
import stringifyObject from 'stringify-object';

import ProviderAdapter  from './provider-adapter';
import config  from '../peersocket.config.js';
import waitChannel from '../utils/wait-channel';
import DataWrapper  from '../utils/data-wrapper';

const log = debug('peersocket');
const providers = {}, consumers = {};

// provider map
// {
//   providerId:
//   socket: ...
// }
// consumer map
// {
//   provider: // instance provider-adapter
//   consumerId:
//   providerId:
//   socket:
// }
const server = http.createServer();

const providerIO = io(server, {
  path: '/ntf-provider',
  serveClient: false,
  pingInterval: config.pingInterval,
  pingTimeout: config.pingTimeout,
  cookie: false
});

const consumerIO = io(server, {
  path: '/ntf',
  serveClient: false,
  pingInterval: config.pingInterval,
  pingTimeout: config.pingTimeout,
  cookie: false
});

function onError(socket, message) {
  socket.emit('will-close', message);
  log(message);
}

server.listen(config.port);

log('server started and listen on port: ' + config.port);

providerIO.on('connect', (socket) => {
  log('provider connected');
  let sessionProviderId;

  let initTimer = setTimeout(() => {
    onError(socket, `have not received provider initial request in ${INIT_TIMEOUT}ms. close session.`);
    socket.disconnect();
  }, config.initTimeout);

  socket.on('initialize', ({ providerId, authToken }) => {
    clearTimeout(initTimer);

    sessionProviderId = providerId;

    if (providers[sessionProviderId] && providers[sessionProviderId].socket) {
      try {
        const prevSocket = providers[sessionProviderId].socket;
        onError(prevSocket, 'provider reconnected, and close previous session');
        prevSocket.disconnect();
      } catch (e) {}
    }

    if (authorizeProvider(socket, sessionProviderId, authToken)) {
      log('provider authenticate with id: ' + sessionProviderId);
      providers[sessionProviderId] = { providerId: sessionProviderId, socket };
      socket.emit('initialize-response', 'ok');
    } else {
      onError(socket, 'provider initialization fail');
      socket.disconnect();
    }
  });

  socket.on('disconnect', () => {

    if (providers[sessionProviderId]) {
      providers[sessionProviderId].socket.disconnect();
      delete providers[sessionProviderId];
      log('cleanup provider ' + sessionProviderId + ' since it disconnected');
    }
  });

  socket.on('exchange-ice', async (wrappedData) => {
    const { consumerId } = wrappedData;
    const consumer = consumers[consumerId];
    if (consumer) {
      await consumer.provider.request(consumer.socket, 'exchange-ice', wrappedData);
    }
  });

  socket.on('exchange-answer', async (wrappedData) => {
    const { consumerId } = wrappedData;
    const consumer = consumers[consumerId];
    if (consumer) {
      await consumer.provider.request(consumer.socket, 'exchange-answer', wrappedData);
    }
  });

  socket.on('data-channel-ready', (wrappedData) => {
    const { consumerId } = wrappedData;
    const consumer = consumers[consumerId];

    if (consumer) {
      consumer.provider.request(consumer.socket, 'data-channel-ready', wrappedData);
    }
  });
});

consumerIO.on('connect', (socket) => {
  const consumerId = socket.id;

  log('consumer[' + consumerId + '] connected');

  let initTimer = setTimeout(() => {
    onError(socket, `server have not received consumer initial request in ${INIT_TIMEOUT}ms. close session.`);
    socket.disconnect();
  }, config.initTimeout);

  const onConsumerNotExist = () => {
    onError(socket, 'consumer not initialized yet');
    socket.disconnect();
  };

  const onProviderNotExist = () => {
    onError(socket, 'provider is not available yet');
    socket.disconnect();
  };

  socket.on('initialize', async ({ providerId, authToken }) => {
    clearTimeout(initTimer);
    if (authorizeConsumer(socket, providerId, authToken)) {
      log('consumer[' + consumerId + '] connected to provider: ' + providerId);
      consumers[consumerId] = { consumerId, providerId, socket, provider: new ProviderAdapter(providerId) };

      if (providers[providerId] && providers[providerId].socket) {
        const providerSocket = providers[providerId].socket;

        providerSocket.emit('init-peer', consumerId);
        await waitChannel(providerSocket, 'init-peer-response');

        socket.emit('initialize-response', 'meet exception');
      } else {
        socket.emit('initialize-response', 'meet exception');
        onProviderNotExist();
      }
    } else {
      socket.emit('initialize-response', 'ok');
      onError(socket, 'consumer initialization fail');
      socket.disconnect();
    }
  });

  const onRequest = (handler) => {
    return async (wrappedData) => {
      log('consumer[' + consumerId + '] received a request');
      // log(stringifyObject(wrappedData));
      if (wrappedData.consumerId === consumerId) {
        if (consumers[consumerId]) {
          const { providerId, provider } = consumers[consumerId];
          if (providers[providerId]) {
            await handler(provider, providers[providerId].socket, wrappedData);
          } else {
            onProviderNotExist();
          }
        } else {
          onConsumerNotExist();
        }
      }
    };
  };

  socket.on('exchange-ice', onRequest(async (provider, socket, wrappedData) => {
    log('consumer[' + consumerId + '] ice candidate received, and exchange with provider[' + provider.id + ']');
    await provider.request(socket, 'exchange-ice', wrappedData);
  }));

  socket.on('exchange-offer', onRequest(async (provider, socket, wrappedData) => {
    log('consumer[' + consumerId + '] offer received, and exchange with provider[' + provider.id + ']');
    await provider.request(socket, 'exchange-offer', wrappedData);
  }));

  socket.on('disconnect', async function() {
    const consumer = consumers[consumerId];
    if (consumer) {
      const { providerId, provider } = consumers[consumerId];

      if (providers[providerId] && providers[providerId].socket) {
        log('consumer[' + consumerId + '] disconnected, and notify provider[' + provider.id + ']');
        await provider.request(providers[providerId].socket, 'consumer-disconnect', new DataWrapper(
          consumerId,
          providerId,
        ));
        log('consumer[' + consumerId + '] disconnected, and provider received notification');
      }
      provider.cleanup();
    }

    delete consumers[socket.id];
    log('consumer[' + consumerId + '] disconnected');
  });
});

function authorizeProvider(socket, id, authToken) {
  return true; //TODO
}

function authorizeConsumer(socket, authToken) {
  return true; //TODO
}
