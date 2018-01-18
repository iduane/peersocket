import defer from './defer';
import { setTimeout } from 'timers';

export default (ms) => {
  const { promise, resolve } =  defer();
  setTimeout(resolve, ms);
  return promise;
}
