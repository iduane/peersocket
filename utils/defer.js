const defer = (timeout, onTimeout) => {
  let resolve = null, reject = null, timerId = null;

  if (timeout) {
    timerId = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
      reject(new Error('timeout'));
    }, timeout);
  }

  const promise = new Promise((rlv, rej) => {
    resolve = rlv;
    reject = rej;
  });

  return {promise, resolve: function(data) {
      clearTimeout(timerId);
      resolve(data);
    }, reject};
};

export default defer;
