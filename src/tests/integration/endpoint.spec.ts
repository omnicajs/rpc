import {describe, it, expect} from 'vitest';
import {
  createEndpoint as createUpstreamEndpoint,
  fromMessagePort as fromUpstreamMessagePort,
} from 'upstream-rpc';

import {createEndpoint} from '../../endpoint';
import {fromMessagePort} from '../../adaptors/index';
import {FunctionReleasedError} from '../../errors';
import {retain, release} from '../../memory';
import {
  createCatchingMessageEndpoint,
  createCatchingUpstreamMessageEndpoint,
  createPair,
} from '../helpers';

describe('call-site stack enrichment', () => {
  it('error.rejection contains rpc metadata', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{fail(): void}>(fromMessagePort(port1));
    const ep2 = createEndpoint(createCatchingMessageEndpoint(port2));

    ep2.expose({
      fail() {
        throw new Error('remote error');
      },
    });

    let caught: any | undefined;

    try {
      await ep1.call.fail();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught.rejection).toBeDefined();
    expect(caught.rejection.kind).toBeDefined();
  });

  it('successful call does not leave a pending stack entry', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{ping(): string}>(fromMessagePort(port1));
    const ep2 = createEndpoint(createCatchingMessageEndpoint(port2));

    ep2.expose({ping: () => 'pong'});

    const result = await ep1.call.ping();

    expect(result).toBe('pong');
    expect(await ep1.call.ping()).toBe('pong');
  });

  it('remote stack is preserved in error.rejection.stack', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{compute(n: number): number}>(
      fromMessagePort(port1),
    );
    const ep2 = createEndpoint(createCatchingMessageEndpoint(port2));

    ep2.expose({
      compute() {
        throw new RangeError('out of range');
      },
    });

    let caught: any | undefined;
    try {
      await ep1.call.compute(42);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught.rejection.stack).toContain('compute');
  });
});

describe('function proxy lifecycle', () => {
  it('returned callback works before release', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{
      getMultiplier(): (n: number) => Promise<number>;
    }>(fromMessagePort(port1));
    const ep2 = createEndpoint(fromMessagePort(port2));

    ep2.expose({getMultiplier: () => (num: number) => num * 3});

    const multiply = await ep1.call.getMultiplier();

    retain(multiply);

    expect(await multiply(7)).toBe(21);

    release(multiply);
  });

  it('throws FunctionReleasedError("released") after release()', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{getAdder(): (n: number) => Promise<number>}>(
      fromMessagePort(port1),
    );
    const ep2 = createEndpoint(fromMessagePort(port2));

    ep2.expose({getAdder: () => (num: number) => num + 10});

    const add = await ep1.call.getAdder();

    retain(add);

    expect(await add(5)).toBe(15);

    release(add);

    expect(() => add(5)).toThrow(FunctionReleasedError);
    expect(() => add(5)).toThrow(expect.objectContaining({state: 'released'}));
  });

  it('throws FunctionReleasedError("revoked") when provider endpoint terminates', async () => {
    const {port1, port2} = createPair();
    const ep1 = createEndpoint<{getGreeter(): () => Promise<string>}>(
      fromMessagePort(port1),
    );
    const ep2 = createEndpoint(fromMessagePort(port2));

    ep2.expose({getGreeter: () => () => 'hello'});

    const greet = await ep1.call.getGreeter();

    retain(greet);

    expect(await greet()).toBe('hello');

    ep2.terminate();

    expect(() => greet()).toThrow(FunctionReleasedError);
    expect(() => greet()).toThrow(expect.objectContaining({state: 'revoked'}));
  });

  it('callback passed as argument works and throws after remote releases it', async () => {
    const {port1, port2} = createPair();
    let storedCb: ((n: number) => number) | undefined;
    const ep1 = createEndpoint<{run(cb: (n: number) => number): number}>(
      fromMessagePort(port1),
    );
    const ep2 = createEndpoint(fromMessagePort(port2));

    ep2.expose({
      run(cb: (n: number) => number) {
        storedCb = cb;
        retain(cb);
        return cb(4);
      },
    });

    await ep1.call.run((num) => num * 2);

    expect(storedCb).toBeDefined();

    release(storedCb!);

    expect(() => storedCb!(4)).toThrow(FunctionReleasedError);
    expect(() => storedCb!(4)).toThrow(
      expect.objectContaining({state: 'released'}),
    );
  });
});

describe('upstream compatibility', () => {
  it('fork endpoint can call upstream endpoint and decode result', async () => {
    const {port1, port2} = createPair();
    const fork = createEndpoint<{sum(a: number, b: number): number}>(
      fromMessagePort(port1),
    );
    const upstream = createUpstreamEndpoint<{
      sum(a: number, b: number): number;
    }>(fromUpstreamMessagePort(port2));

    upstream.expose({sum: (x: number, y: number) => x + y});

    expect(await fork.call.sum(20, 22)).toBe(42);
  });

  it('upstream endpoint can call fork endpoint and decode result', async () => {
    const {port1, port2} = createPair();
    const fork = createEndpoint<{mul(a: number, b: number): number}>(
      fromMessagePort(port1),
    );
    const upstream = createUpstreamEndpoint<{
      mul(a: number, b: number): number;
    }>(fromUpstreamMessagePort(port2));

    fork.expose({mul: (x: number, y: number) => x * y});

    expect(await upstream.call.mul(6, 7)).toBe(42);
  });

  it('supports callback roundtrip across fork and upstream', async () => {
    const {port1, port2} = createPair();
    const fork = createEndpoint<{
      runWithCallback(cb: (n: number) => number): number;
    }>(fromMessagePort(port1));
    const upstream = createUpstreamEndpoint<{
      runWithCallback(cb: (n: number) => number): number;
    }>(fromUpstreamMessagePort(port2));

    upstream.expose({
      runWithCallback(cb: (n: number) => number) {
        return cb(21);
      },
    });

    expect(await fork.call.runWithCallback((num) => num * 2)).toBe(42);
  });

  it('propagates upstream rejection message to fork caller', async () => {
    const {port1, port2} = createPair();
    const fork = createEndpoint<{explode(): void}>(fromMessagePort(port1));
    const upstream = createUpstreamEndpoint<{explode(): void}>(
      createCatchingUpstreamMessageEndpoint(port2),
    );

    upstream.expose({
      explode() {
        throw new Error('upstream boom');
      },
    });

    let thrown: Error | undefined;

    try {
      await fork.call.explode();
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown?.message).toBe('upstream boom');
  });
});
