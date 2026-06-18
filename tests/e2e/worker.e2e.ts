import {afterEach, describe, expect, test} from 'vitest';

import {createEndpoint, fromWebWorker, release, retain} from '@/index';

interface User {
  fullName(): string;
  onGreeting(message: string): void;
}

interface WorkerApi {
  greet(user: User): string;
  createFormatter(): (value: number) => string;
}

describe('Worker RPC e2e', () => {
  let worker: Worker | undefined;

  afterEach(() => {
    worker?.terminate();
    worker = undefined;
  });

  test('calls exposed worker methods and host callbacks through a real Worker', async () => {
    worker = new Worker(
      new URL('./fixtures/worker-rpc.worker.ts', import.meta.url),
      {type: 'module'},
    );

    const endpoint = createEndpoint<WorkerApi>(fromWebWorker(worker));
    const greetings: string[] = [];

    endpoint.expose({
      getHostName() {
        return 'host';
      },
    });

    await expect(
      endpoint.call.greet({
        fullName() {
          return 'Ada Lovelace';
        },
        onGreeting(message) {
          greetings.push(message);
        },
      }),
    ).resolves.toBe('host greets Ada Lovelace');

    expect(greetings).toEqual(['host greets Ada Lovelace']);

    endpoint.terminate();
    worker = undefined;
  });

  test('retains and releases function proxies returned by a Worker', async () => {
    worker = new Worker(
      new URL('./fixtures/worker-rpc.worker.ts', import.meta.url),
      {type: 'module'},
    );

    const endpoint = createEndpoint<WorkerApi>(fromWebWorker(worker));

    const formatter = await endpoint.call.createFormatter();

    retain(formatter);

    await expect(formatter(42)).resolves.toBe('worker:42');

    release(formatter);

    expect(() => formatter(42)).toThrow(/already released/);

    endpoint.terminate();
    worker = undefined;
  });
});
