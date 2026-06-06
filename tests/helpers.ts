import {fromMessagePort as fromUpstreamMessagePort} from 'upstream-rpc';

import {fromMessagePort} from '@/adaptors';
import {MessagePortPolyfill} from '@/polyfill';
import type {MessageEndpoint} from '@/types';

export function createPair(): {port1: MessagePort; port2: MessagePort} {
  const port1 = new MessagePortPolyfill();
  const port2 = new MessagePortPolyfill();
  port1.otherPort = port2;
  port2.otherPort = port1;
  port1.start();
  port2.start();
  return {port1, port2};
}

export function createCatchingMessageEndpoint(
  messagePort: MessagePort,
): MessageEndpoint {
  const messageEndpoint = fromMessagePort(messagePort);

  return {
    ...messageEndpoint,
    addEventListener: (event, listener) => {
      messageEndpoint.addEventListener(event, async (...args) => {
        try {
          await listener(...args);
        } catch {
          /* empty */
        }
      });
    },
  };
}

export function createCatchingUpstreamMessageEndpoint(
  messagePort: MessagePort,
): ReturnType<typeof fromUpstreamMessagePort> {
  const messageEndpoint = fromUpstreamMessagePort(messagePort);

  return {
    ...messageEndpoint,
    addEventListener: (
      event: Parameters<typeof messageEndpoint.addEventListener>[0],
      listener: Parameters<typeof messageEndpoint.addEventListener>[1],
    ) => {
      messageEndpoint.addEventListener(event, async (...args) => {
        try {
          await listener(...args);
        } catch {
          /* empty */
        }
      });
    },
  };
}
