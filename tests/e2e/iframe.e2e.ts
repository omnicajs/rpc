import {afterEach, describe, expect, test} from 'vitest';

import {createEndpoint, fromIframe} from '@/index';

interface IframeApi {
  callHost(callback: (value: string) => string, value: string): string;
  summarize(payload: {prefix: string; value: number}): string;
}

describe('iframe RPC e2e', () => {
  let iframe: HTMLIFrameElement | undefined;

  afterEach(() => {
    iframe?.remove();
    iframe = undefined;
  });

  test('waits for iframe readiness and exchanges calls with the child frame', async () => {
    iframe = document.createElement('iframe');
    iframe.src = new URL('./fixtures/iframe-child.html', import.meta.url).href;
    document.body.append(iframe);

    const endpoint = createEndpoint<IframeApi>(fromIframe(iframe));
    const seenValues: string[] = [];

    await expect(
      endpoint.call.callHost((value) => {
        seenValues.push(value);
        return `host:${value}`;
      }, 'payload'),
    ).resolves.toBe('host:payload');

    await expect(
      endpoint.call.summarize({prefix: 'iframe', value: 7}),
    ).resolves.toBe('iframe:7');

    expect(seenValues).toEqual(['payload']);

    endpoint.terminate();
    iframe = undefined;
  });
});
