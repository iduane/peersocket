import { expect } from 'chai';
import BrokerFinder from '../src/broker-finder';


describe('Broker Finder', () => {
  it ('should get server address', async () => {
    const url = await BrokerFinder();
    console.log(url);
    expect(url.indexOf('http://')).to.gte(0);
  }).timeout(10000);
});
