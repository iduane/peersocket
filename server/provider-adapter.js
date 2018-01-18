import defer from '../utils/defer';

export default class Provider {
  constructor(id) {
    this.id = id;
    this.watchMap = {};
  }

  async waitForResponse(socket, channelName, wrappedData) {
    const { promise, resolve, reject } = defer();

    let waiter = this.watchMap[channelName];

    if (!waiter) {
      waiter = this.watchMap[channelName] = {};
      socket.once(channelName + '-response', (response) => {
        if (response && response.rid) {
          const waiter = this.watchMap[channelName];
          const { rid } = response;
          if (waiter && waiter[rid]) {
            waiter[rid].resolve(response.data);
          }
        }
      });
    }

    waiter[wrappedData.rid] = { resolve, reject };

    return promise;
  }

  async request(socket, channelName, wrappedData) {
    if (socket) {
      socket.emit(channelName, wrappedData);
      return this.waitForResponse(socket, channelName, wrappedData);
    }
  }

  cleanup() {
  }
}
