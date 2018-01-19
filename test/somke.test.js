import { expect } from 'chai';
import { seed, peer } from '../src/index';

const testBroker = 'http://localhost:13799';

let resources = [];

describe('Smoke', () => {
  afterEach(() => {
    resources.forEach((res) => res.close());
    resources = [];
  });

  it ('ping pong', async () => {
    const seed1 = new seed(testBroker, 'seed1', 'i am seed1');
    resources.push(seed1);
    await seed1.waitEventOnce('registered');

    const peer1 = new peer(testBroker, 'seed1');
    resources.push(peer1);
    await peer1.waitEventOnce('connected');

    peer1.send('ping');
    const data = await seed1.waitEventOnce('data');

    expect(data).to.eq('ping');

    seed1.send(peer1.id, 'pong');
    const data2 = await peer1.waitEventOnce('data');

    expect(data2).to.eq('pong');
  }).timeout(10000);
});
