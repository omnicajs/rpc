import {describe, it, expect, vi} from 'vitest';

import {createBasicEncoder} from '@/encoding';
import {FunctionReleasedError} from '@/errors';
import {
  release,
  retain,
  StackFrame,
  RELEASE_METHOD,
  RETAINED_BY,
  RETAIN_METHOD,
} from '@/memory';
import type {EncodingStrategyApi} from '@/types';

const FUNCTION = '_@f';

function createApi(): EncodingStrategyApi & {
  call: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  uuid: ReturnType<typeof vi.fn>;
} {
  let id = 0;

  return {
    call: vi.fn(),
    release: vi.fn(),
    uuid: vi.fn(() => `id-${(id += 1)}`),
  } as any;
}

describe('createBasicEncoder()', () => {
  it('encodes and decodes primitive null values', () => {
    const encoder = createBasicEncoder(createApi());

    expect(encoder.encode(null)).toEqual([null]);
    expect(encoder.decode(null)).toBe(null);
  });

  it('preserves shared references while encoding arrays and objects', () => {
    const encoder = createBasicEncoder(createApi());
    const shared = {value: 1};
    const value: any = {items: [shared, shared]};
    value.self = value;

    const [encoded] = encoder.encode(value);

    expect(encoded.items[0]).toBe(encoded.items[1]);
    expect(encoded.self).toBeUndefined();
    expect(encoder.decode(encoded)).toEqual({
      items: [{value: 1}, {value: 1}],
      self: undefined,
    });
  });

  it('passes through non-basic objects', () => {
    const encoder = createBasicEncoder(createApi());
    const date = new Date('2026-06-06T00:00:00.000Z');

    expect(encoder.encode(date)).toEqual([date]);
    expect(encoder.decode(date)).toBe(date);
  });

  it('reuses encoded function IDs and releases them', async () => {
    const api = createApi();
    const encoder = createBasicEncoder(api);
    const fn = vi.fn((value: string) => `received ${value}`);

    expect(encoder.encode(fn)).toEqual([{[FUNCTION]: 'id-1'}]);
    expect(encoder.encode(fn)).toEqual([{[FUNCTION]: 'id-1'}]);
    expect(api.uuid).toHaveBeenCalledTimes(1);

    await expect(encoder.call('id-1', ['value'])).resolves.toBe(
      'received value',
    );

    encoder.release('unknown');
    encoder.release('id-1');

    await expect(encoder.call('id-1', [])).rejects.toBeInstanceOf(
      FunctionReleasedError,
    );
  });

  it('manages decoded function proxies', async () => {
    const api = createApi();
    api.call.mockResolvedValue('result');
    const encoder = createBasicEncoder(api);
    const stackFrame = new StackFrame();

    const proxy = encoder.decode({[FUNCTION]: 'remote-id'}, [
      stackFrame,
    ]) as (...args: any[]) => Promise<unknown>;

    expect(encoder.decode({[FUNCTION]: 'remote-id'})).toBe(proxy);
    await expect(proxy('argument')).resolves.toBe('result');
    expect(api.call).toHaveBeenCalledWith('remote-id', ['argument']);

    retain(proxy);
    release(proxy);
    expect(api.release).not.toHaveBeenCalled();

    stackFrame.release();
    expect(api.release).toHaveBeenCalledWith('remote-id');
    expect(() => proxy()).toThrow(FunctionReleasedError);
    expect(() => proxy()).toThrow(expect.objectContaining({state: 'released'}));
  });

  it('revokes decoded function proxies on terminate', () => {
    const encoder = createBasicEncoder(createApi());
    const proxy = encoder.decode({[FUNCTION]: 'remote-id'}) as () => unknown;

    encoder.terminate?.();

    expect(() => proxy()).toThrow(FunctionReleasedError);
    expect(() => proxy()).toThrow(expect.objectContaining({state: 'revoked'}));
  });

  it('calls retained memory manageable functions with inherited retainers', async () => {
    const api = createApi();
    api.call.mockResolvedValue('remote result');
    const encoder = createBasicEncoder(api);
    const retainer = new StackFrame();
    const callback = vi.fn((proxy: () => Promise<string>) => proxy());

    Object.defineProperties(callback, {
      [RELEASE_METHOD]: {value: vi.fn(), writable: false},
      [RETAIN_METHOD]: {value: vi.fn(), writable: false},
      [RETAINED_BY]: {value: new Set([retainer]), writable: false},
    });

    encoder.encode(callback);

    await expect(encoder.call('id-1', [{[FUNCTION]: 'remote-id'}])).resolves.toBe(
      'remote result',
    );

    expect(api.call).toHaveBeenCalledWith('remote-id', []);
    expect(api.release).not.toHaveBeenCalled();

    retainer.release();

    expect(api.release).toHaveBeenCalledWith('remote-id');
  });
});
