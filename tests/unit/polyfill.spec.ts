import {describe, it, expect, vi} from 'vitest';

import {MessagePortPolyfill, pair} from '@/polyfill';

describe('MessagePortPolyfill', () => {
  it('queues messages until the port is started', () => {
    const port1 = new MessagePortPolyfill();
    const port2 = new MessagePortPolyfill();
    const listener = vi.fn();

    pair(port1, port2);
    port2.close();
    port2.addEventListener('message', listener);

    port1.postMessage('queued');

    expect(listener).not.toHaveBeenCalled();

    port2.start();

    expect(listener).toHaveBeenCalledWith({data: 'queued'});
  });

  it('starts when onmessage is assigned', () => {
    const port1 = new MessagePortPolyfill();
    const port2 = new MessagePortPolyfill();
    const listener = vi.fn();

    port1.otherPort = port2;
    port1.postMessage('queued');

    port2.onmessage = listener;

    expect(port2.onmessage).toBe(listener);
    expect(listener).toHaveBeenCalledWith({data: 'queued'});
  });

  it('adds and removes message listeners', () => {
    const port1 = new MessagePortPolyfill();
    const port2 = new MessagePortPolyfill();
    const listener = vi.fn();
    const ignoredListener = vi.fn();

    pair(port1, port2);

    port2.addEventListener('close', ignoredListener);
    port2.addEventListener('message', listener);
    port1.postMessage('first');

    port2.removeEventListener('close', listener);
    port2.removeEventListener('message', listener);
    port1.postMessage('second');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({data: 'first'});
    expect(ignoredListener).not.toHaveBeenCalled();
  });

  it('ignores postMessage calls without a paired port', () => {
    const port = new MessagePortPolyfill();

    expect(() => port.postMessage('message')).not.toThrow();
  });
});
