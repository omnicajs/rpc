import {describe, it, expect} from 'vitest';

import {createEndpoint} from '../../endpoint';
import {fromMessagePort} from '../../adaptors/index';
import {CallAfterTerminateError, FunctionReleasedError} from '../../errors';
import {retain, release} from '../../memory';
import {createCatchingMessageEndpoint, createPair} from '../helpers';

describe('CallAfterTerminateError', () => {
  it('is thrown when calling a method after termination', async () => {
    const {port1} = createPair();
    const ep = createEndpoint<{ping(): string}>(fromMessagePort(port1));

    ep.terminate();

    await expect(ep.call.ping()).rejects.toBeInstanceOf(
      CallAfterTerminateError,
    );
  });
});

describe('FunctionReleasedError', () => {
  describe('state "released"', () => {
    it('is thrown after release()', async () => {
      const {port1, port2} = createPair();
      const ep1 = createEndpoint<{getCb(): () => void}>(fromMessagePort(port1));
      const ep2 = createEndpoint(fromMessagePort(port2));

      ep2.expose({getCb: () => () => {}});

      const cb = await ep1.call.getCb();

      retain(cb);
      release(cb);

      expect(() => cb()).toThrow(FunctionReleasedError);
    });
  });

  describe('state "revoked"', () => {
    it('is thrown when remote endpoint terminates', async () => {
      const {port1, port2} = createPair();
      const ep1 = createEndpoint<{getCb(): () => void}>(fromMessagePort(port1));
      const ep2 = createEndpoint(fromMessagePort(port2));

      ep2.expose({getCb: () => () => {}});

      const cb = await ep1.call.getCb();

      retain(cb);
      ep2.terminate();

      expect(() => cb()).toThrow(FunctionReleasedError);
    });
  });
});

describe('NoExposedMethodError', () => {
  it('is thrown on the remote side and rejection propagates to caller', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{hello(): string}>(fromMessagePort(port1));
    const ep2 = createEndpoint(createCatchingMessageEndpoint(port2));

    ep2.expose({});

    let err: unknown;

    try {
      await ep1.call.hello();
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect((err as any).rejection).toMatchObject({
      kind: 'no-exposed-method',
      method: 'hello',
    });
  });

  describe('remote rejection stack', () => {
    it('propagates remote stack in error.rejection.stack', async () => {
      const {port1, port2} = createPair();
      const ep1 = createEndpoint<{explode(): void}>(fromMessagePort(port1));
      const ep2 = createEndpoint(createCatchingMessageEndpoint(port2));

      ep2.expose({
        explode() {
          throw new Error('boom');
        },
      });

      const err = await ep1.call.explode().catch((error) => error);

      expect(err).toBeDefined();
      expect(err.rejection).toBeDefined();
      expect(err.rejection.stack).toContain('explode');
    });
  });
});
