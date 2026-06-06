import {afterEach, describe, it, expect, vi} from 'vitest';

import {READY_MESSAGE_KEY} from '@/adaptors/constants';
import {fromIframe} from '@/adaptors/iframe-parent';
import {fromInsideIframe} from '@/adaptors/iframe-child';
import {fromMessagePort} from '@/adaptors/message-port';
import {fromWebWorker} from '@/adaptors/web-worker';
import {MessagePortPolyfill, pair} from '@/polyfill';

type Listener = (event: MessageEvent) => void;

function createWindowMock() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    addEventListener: vi.fn((event: string, listener: Listener) => {
      const eventListeners = listeners.get(event) ?? new Set<Listener>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    }),
    removeEventListener: vi.fn((event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    }),
    dispatch(event: string, message: any) {
      for (const listener of listeners.get(event) ?? []) {
        listener(message as MessageEvent);
      }
    },
  };
}

describe('adaptors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a worker as a message endpoint', () => {
    const worker = {
      addEventListener: vi.fn(),
      postMessage: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    } as unknown as Worker;

    expect(fromWebWorker(worker)).toBe(worker);
  });

  it('wraps MessagePort instances', () => {
    const port1 = new MessagePortPolyfill();
    const port2 = new MessagePortPolyfill();
    const listener = vi.fn();

    pair(port1, port2);

    const endpoint = fromMessagePort(port1);
    const close = vi.spyOn(port1, 'close');
    port2.addEventListener('message', listener);
    endpoint.postMessage('hello');

    expect(listener).toHaveBeenCalledWith({data: 'hello'});

    endpoint.terminate?.();

    expect(close).toHaveBeenCalled();
  });

  it('throws when fromIframe is used without a browser window', () => {
    vi.stubGlobal('window', undefined);

    expect(() => fromIframe({} as HTMLIFrameElement)).toThrow(/no window/);
  });

  it('waits for iframe readiness and filters iframe messages by source', async () => {
    const windowMock = createWindowMock();
    const contentWindow = {postMessage: vi.fn()};
    const target = {
      contentWindow,
      remove: vi.fn(),
    } as unknown as HTMLIFrameElement;

    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('self', windowMock);

    const endpoint = fromIframe(target);
    const listener = vi.fn();

    endpoint.addEventListener('message', listener);
    windowMock.dispatch('message', {source: {}, data: 'ignored'});
    windowMock.dispatch('message', {source: contentWindow, data: 'not-ready'});
    windowMock.dispatch('message', {
      source: contentWindow,
      data: READY_MESSAGE_KEY,
    });
    listener.mockClear();
    windowMock.dispatch('message', {source: contentWindow, data: 'payload'});

    await endpoint.postMessage('outgoing', ['transfer'] as any);

    expect(contentWindow.postMessage).toHaveBeenCalledWith(
      READY_MESSAGE_KEY,
      '*',
    );
    expect(contentWindow.postMessage).toHaveBeenCalledWith('outgoing', '*', [
      'transfer',
    ]);
    expect(listener).toHaveBeenCalledWith({
      source: contentWindow,
      data: 'payload',
    });

    endpoint.removeEventListener('message', vi.fn());
    endpoint.removeEventListener('message', listener);
    windowMock.dispatch('message', {source: contentWindow, data: 'removed'});

    expect(listener).toHaveBeenCalledTimes(1);

    endpoint.terminate?.();

    expect(target.remove).toHaveBeenCalled();
  });

  it('can keep iframe targets alive on terminate', () => {
    const windowMock = createWindowMock();
    const target = {
      contentWindow: {postMessage: vi.fn()},
      remove: vi.fn(),
    } as unknown as HTMLIFrameElement;

    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('self', windowMock);

    const endpoint = fromIframe(target, {terminate: false});

    endpoint.terminate?.();

    expect(target.remove).not.toHaveBeenCalled();
  });

  it('throws when fromInsideIframe is used outside a child iframe', () => {
    vi.stubGlobal('self', {parent: null});

    expect(() => fromInsideIframe()).toThrow(/no parent window/);
  });

  it('announces a ready child iframe and filters parent messages', () => {
    const windowMock = createWindowMock();
    const parent = {postMessage: vi.fn()};
    const documentMock = {
      addEventListener: vi.fn(),
      readyState: 'complete',
    };

    vi.stubGlobal('self', {...windowMock, parent});
    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('document', documentMock);

    const endpoint = fromInsideIframe({targetOrigin: 'https://example.com'});
    const listener = vi.fn();

    endpoint.addEventListener('message', listener);
    windowMock.dispatch('message', {source: {}, data: 'ignored'});
    windowMock.dispatch('message', {source: parent, data: READY_MESSAGE_KEY});
    listener.mockClear();
    windowMock.dispatch('message', {source: parent, data: 'payload'});
    endpoint.postMessage('outgoing', ['transfer'] as any);

    expect(parent.postMessage).toHaveBeenCalledWith(
      READY_MESSAGE_KEY,
      'https://example.com',
    );
    expect(parent.postMessage).toHaveBeenCalledWith('outgoing', 'https://example.com', [
      'transfer',
    ]);
    expect(listener).toHaveBeenCalledWith({source: parent, data: 'payload'});

    endpoint.removeEventListener('message', vi.fn());
    endpoint.removeEventListener('message', listener);
    windowMock.dispatch('message', {source: parent, data: 'removed'});

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('announces child iframe readiness after document completion', () => {
    const windowMock = createWindowMock();
    const parent = {postMessage: vi.fn()};
    let readystatechange: (() => void) | undefined;
    const documentMock = {
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        readystatechange = listener;
      }),
      readyState: 'loading',
    };

    vi.stubGlobal('self', {...windowMock, parent});
    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('document', documentMock);

    fromInsideIframe();
    windowMock.dispatch('message', {source: parent, data: READY_MESSAGE_KEY});

    expect(parent.postMessage).not.toHaveBeenCalled();

    readystatechange?.();

    expect(parent.postMessage).not.toHaveBeenCalled();

    documentMock.readyState = 'complete';
    readystatechange?.();

    expect(parent.postMessage).toHaveBeenCalledWith(READY_MESSAGE_KEY, '*');
  });
});
