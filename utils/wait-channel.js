import defer from './defer';
import debug from 'debug';

export default (socket, channelName, filter = () => true, timeout = 100000) => {
  const { promise, resolve, reject } = defer();
  const timerId = setTimeout(() => {
    debug('peersocket')('reject promise since it timeout');
    reject(new Error('timeout'));
  }, timeout);
  socket.once(channelName, (data) => {
    if (filter(data)) {
      clearTimeout(timerId);
      resolve(data);
    }
  });

  return promise;
};
