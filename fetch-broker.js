import BrokerFinder from './src/broker-finder';

(async() => {
  const url = await BrokerFinder();

  if (url) {
    return url;
  } else {
    return 'http://localhost:13799';
  }
})();
