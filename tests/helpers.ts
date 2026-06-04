import {fromMessagePort as fromUpstreamMessagePort} from 'upstream-rpc';

import {fromMessagePort} from '@/adaptors';
import type {MessageEndpoint} from '@/types';

import {MessageChannel} from '~tests/utilities';

export function createPair(): {port1: MessagePort; port2: MessagePort} {
  const {port1, port2} = new MessageChannel();
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
