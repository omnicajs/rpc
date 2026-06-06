import {afterEach, describe, it, expect, vi} from 'vitest';

import {CALL, FUNCTION_APPLY, FUNCTION_RESULT, RESULT, TERMINATE} from '@/endpoint';
import {createEndpoint, MissingResolverError} from '@/index';
import {fromMessagePort} from '@/adaptors';
import {FunctionReleasedError} from '@/errors';
import {release, retain} from '@/memory';
import type {MessageEndpoint} from '@/types';
import {createCatchingMessageEndpoint, createPair} from '~tests/helpers';

function createManualMessageEndpoint(): MessageEndpoint & {
  listener?: (event: MessageEvent) => void | Promise<void>;
  postMessage: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
} {
  const endpoint = {
    postMessage: vi.fn(),
    addEventListener: vi.fn((_event, listener) => {
      endpoint.listener = listener;
    }),
    removeEventListener: vi.fn(),
  } as MessageEndpoint & {
    listener?: (event: MessageEvent) => void | Promise<void>;
    postMessage: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  return endpoint;
}

describe('createEndpoint()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the exposed API of the paired endpoint', async () => {
    const {port1, port2} = createPair();
    const endpoint1 = createEndpoint<{hello(): string}>(fromMessagePort(port1));
    const endpoint2 = createEndpoint(fromMessagePort(port2));
    const spy = vi.fn(() => 'world');

    endpoint2.expose({hello: spy});

    expect(await endpoint1.call.hello()).toBe('world');
  });

  describe('#replace()', () => {
    it('replaces the underlying messenger', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{hello(): string}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(fromMessagePort(port2));

      endpoint2.expose({hello: () => 'world'});

      const {port1: newPort1, port2: newPort2} = createPair();

      endpoint1.replace(fromMessagePort(newPort1));
      endpoint2.replace(fromMessagePort(newPort2));

      expect(await endpoint1.call.hello()).toBe('world');
    });
  });

  describe('#expose()', () => {
    it('allows a new method to be called from the paired endpoint', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{hello(): string}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(createCatchingMessageEndpoint(port2));

      await expect(endpoint1.call.hello()).rejects.toMatchObject({
        message: expect.stringContaining('hello'),
      });

      endpoint2.expose({hello: () => 'world'});

      expect(await endpoint1.call.hello()).toBe('world');
    });

    it('re-throws errors thrown in exposed methods', async () => {
      expect.assertions(2);
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{hello(): string}>(
        fromMessagePort(port1),
      );
      const messageEndpoint2 = fromMessagePort(port2);
      const endpoint2 = createEndpoint({
        ...messageEndpoint2,
        addEventListener(event, listener) {
          messageEndpoint2.addEventListener(event, async (...args) => {
            await expect(listener(...args)).rejects.toMatchObject({
              message: expect.stringContaining('this is broken'),
            });
          });
        },
      });

      endpoint2.expose({
        hello: () => {
          throw new Error('this is broken');
        },
      });

      await expect(endpoint1.call.hello()).rejects.toMatchObject({
        message: expect.stringContaining('this is broken'),
      });
    });

    it('deletes an exposed value by passing undefined', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{hello(): string}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(createCatchingMessageEndpoint(port2));

      endpoint2.expose({hello: () => 'world'});
      endpoint2.expose({hello: undefined});

      await expect(endpoint1.call.hello()).rejects.toMatchObject({
        message: expect.stringContaining('hello'),
      });
    });
  });

  describe('#terminate()', () => {
    it('calls terminate on the message endpoint', () => {
      const {port1} = createPair();
      const messenger = fromMessagePort(port1);
      const endpoint = createEndpoint(messenger);
      const spy = vi.spyOn(messenger, 'terminate');

      endpoint.terminate();
      expect(spy).toHaveBeenCalled();
    });

    it('calls terminate on the encoding strategy', () => {
      const spy = vi.fn();
      const {port1} = createPair();
      const endpoint = createEndpoint(fromMessagePort(port1), {
        createEncoder: () => ({terminate: spy} as any),
      });

      endpoint.terminate();
      expect(spy).toHaveBeenCalled();
    });

    it('throws an error when calling a method on a terminated endpoint', async () => {
      const {port1} = createPair();
      const endpoint = createEndpoint<{hello(): string}>(
        fromMessagePort(port1),
      );

      endpoint.terminate();

      await expect(endpoint.call.hello()).rejects.toMatchObject({
        message: expect.stringContaining('terminated'),
      });
    });

    it('sends the terminate method between endpoints', async () => {
      const {port1} = createPair();
      const endpoint = createEndpoint<{callMe(): () => void}>(
        fromMessagePort(port1),
      );
      const messageSpy = vi.spyOn(port1, 'postMessage');

      endpoint.terminate();

      expect(messageSpy).toHaveBeenCalledWith([TERMINATE], undefined);
    });

    it('does not send memory management messages to a terminated endpoint', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{callMe(): () => void}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(fromMessagePort(port2));

      endpoint2.expose({
        callMe() {
          return () => {};
        },
      });

      const callMeBack = await endpoint1.call.callMe();

      retain(callMeBack);

      endpoint1.terminate();

      const port1MessageSpy = vi.spyOn(port1, 'postMessage');

      release(callMeBack);

      expect(port1MessageSpy).not.toHaveBeenCalled();
    });

    it('throws a MissingResolverError error when calling a function that is no longer registered', async () => {
      const {port1} = createPair();
      const messenger = fromMessagePort(port1);
      createEndpoint(messenger);

      await expect(
        // @ts-expect-error Accessing private property for testing
        (port1.listeners as Set<EventListener>).values().next().value!({
          data: [1, ['callId']],
        } as any),
      ).rejects.toBeInstanceOf(MissingResolverError);
    });

    it('does not process messages after the endpoint is terminated', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{hello(): string}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(fromMessagePort(port2));
      const spy = vi.fn(() => 'world');

      endpoint2.expose({hello: spy});

      endpoint2.terminate();

      await expect(endpoint1.call.hello()).rejects.toMatchObject({
        message: expect.stringContaining('terminated'),
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('can terminate a messenger without a terminate hook', () => {
      const messenger = createManualMessageEndpoint();
      const endpoint = createEndpoint(messenger);

      endpoint.terminate();

      expect(messenger.removeEventListener).toHaveBeenCalled();
      expect(messenger.postMessage).toHaveBeenCalledWith(
        [TERMINATE],
        undefined,
      );
    });
  });

  describe('message listener edge cases', () => {
    it('ignores malformed messages and messages after termination', async () => {
      const messenger = createManualMessageEndpoint();
      const endpoint = createEndpoint(messenger);

      await expect(
        messenger.listener!({data: 'invalid'} as MessageEvent),
      ).resolves.toBeUndefined();

      endpoint.terminate();

      await expect(
        messenger.listener!({
          data: [CALL, ['id', 'missing', []]],
        } as MessageEvent),
      ).resolves.toBeUndefined();
    });

    it('returns a rejection for function apply messages with missing functions', async () => {
      const messenger = createManualMessageEndpoint();
      createEndpoint(messenger);

      await expect(
        messenger.listener!({
          data: [FUNCTION_APPLY, ['call-id', 'missing-function', []]],
        } as MessageEvent),
      ).rejects.toBeInstanceOf(FunctionReleasedError);

      expect(messenger.postMessage).toHaveBeenCalledWith(
        [
          FUNCTION_RESULT,
          [
            'call-id',
            expect.objectContaining({
              message: expect.stringContaining('released'),
              rejection: expect.objectContaining({
                kind: 'function-already-released',
              }),
            }),
          ],
        ],
        undefined,
      );
    });

    it('classifies DataCloneError failures as encode-decode transport errors', async () => {
      const messenger = createManualMessageEndpoint();
      const endpoint = createEndpoint(messenger);
      const error = new Error('cannot clone');
      error.name = 'DataCloneError';

      endpoint.expose({
        clone() {
          throw error;
        },
      });

      await expect(
        messenger.listener!({
          data: [CALL, ['call-id', 'clone', []]],
        } as MessageEvent),
      ).rejects.toBe(error);

      expect(messenger.postMessage).toHaveBeenCalledWith(
        [
          RESULT,
          [
            'call-id',
            expect.objectContaining({
              rejection: expect.objectContaining({kind: 'encode-decode'}),
            }),
          ],
        ],
        undefined,
      );
    });

    it('serializes non-Error thrown values as unknown transport errors', async () => {
      const messenger = createManualMessageEndpoint();
      const endpoint = createEndpoint(messenger);
      const failure = {toString: () => 'string failure'};

      endpoint.expose({
        fail() {
          throw failure;
        },
      });

      await expect(
        messenger.listener!({
          data: [CALL, ['call-id', 'fail', []]],
        } as MessageEvent),
      ).rejects.toBe(failure);

      expect(messenger.postMessage).toHaveBeenCalledWith(
        [
          RESULT,
          [
            'call-id',
            {
              name: 'Error',
              message: 'string failure',
              rejection: {
                kind: 'unknown',
                method: 'fail',
                stack: undefined,
              },
            },
          ],
        ],
        undefined,
      );
    });
  });

  describe('#call', () => {
    it('rejects symbol method calls', async () => {
      const {port1} = createPair();
      const endpoint = createEndpoint<any>(fromMessagePort(port1));
      const method = endpoint.call[Symbol('method') as any];

      await expect(method()).rejects.toThrow(/symbol method/);
    });

    it('caches proxy method handlers', () => {
      const {port1} = createPair();
      const endpoint = createEndpoint<any>(fromMessagePort(port1));

      expect(endpoint.call.hello).toBe(endpoint.call.hello);
    });

    it('ignores callable additions in proxy mode', () => {
      const {port1} = createPair();
      const endpoint = createEndpoint<any>(fromMessagePort(port1));
      const method = endpoint.call.dynamic;

      endpoint.callable('dynamic');

      expect(endpoint.call.dynamic).toBe(method);
    });

    it('supports explicit callable method lists', () => {
      const {port1} = createPair();
      const endpoint = createEndpoint<{hello(): string; later(): string}>(
        fromMessagePort(port1),
        {callable: ['hello']},
      );

      expect(endpoint.call.hello).toBeTypeOf('function');
      expect((endpoint.call as any).later).toBeUndefined();

      endpoint.callable('later');

      expect(endpoint.call.later).toBeTypeOf('function');
    });

    it('rejects proxy mode when Proxy is unavailable', () => {
      const {port1} = createPair();

      vi.stubGlobal('Proxy', undefined);

      expect(() => createEndpoint(fromMessagePort(port1))).toThrow(/Proxies/);
    });
  });

  describe('FunctionReleasedError in encoder', () => {
    it('throws FunctionReleasedError("revoked") when remote endpoint terminates', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{getCallback(): () => void}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(fromMessagePort(port2));

      endpoint2.expose({getCallback: () => () => {}});

      const callback = await endpoint1.call.getCallback();

      retain(callback);

      endpoint2.terminate();

      expect(() => callback()).toThrow(FunctionReleasedError);
      expect(() => callback()).toThrow(
        expect.objectContaining({state: 'revoked'}),
      );
    });

    it('throws FunctionReleasedError("released") when proxy retain count drops to zero', async () => {
      const {port1, port2} = createPair();
      const endpoint1 = createEndpoint<{getCallback(): () => void}>(
        fromMessagePort(port1),
      );
      const endpoint2 = createEndpoint(fromMessagePort(port2));

      endpoint2.expose({getCallback: () => () => {}});

      const callback = await endpoint1.call.getCallback();

      retain(callback);
      release(callback);

      expect(() => callback()).toThrow(FunctionReleasedError);
      expect(() => callback()).toThrow(
        expect.objectContaining({state: 'released'}),
      );
    });
  });
});

describe('MissingResolverError', () => {
  it('preserves error, result, rejection, and stack details', () => {
    const error = new Error('remote');
    const missingResolverError = new MissingResolverError({
      callId: 'call-id',
      error,
      rejection: {kind: 'unknown', stack: 'remote stack'},
      result: {ok: false},
      stack: 'call stack',
    });

    expect(missingResolverError.message).toContain('call-id');
    expect(missingResolverError.message).toContain('remote');
    expect(missingResolverError.message).toContain('{"ok":false}');
    expect(missingResolverError.error).toBe(error);
    expect(missingResolverError.rejection).toEqual({
      kind: 'unknown',
      stack: 'remote stack',
    });
    expect(missingResolverError.result).toEqual({ok: false});
    expect(missingResolverError.stack).toBe('call stack');
  });
});
