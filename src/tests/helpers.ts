import {MessageChannel} from './utilities';

export function createPair() {
  const {port1, port2} = new MessageChannel();
  port1.start();
  port2.start();
  return {port1, port2};
}
