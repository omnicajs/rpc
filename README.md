# `@omnicajs/rpc`

`@omnicajs/rpc` creates an RPC layer between two `postMessage`-compatible contexts. It lets one side expose functions and the other side call them through message passing. Function arguments and return values can contain callbacks, so APIs can pass event handlers or other callable values across workers, iframes, message ports, or custom transports.

The package ships ESM, CommonJS, and TypeScript declarations.

## Installation

Using `yarn`:

```sh
yarn add @omnicajs/rpc
```

Using `npm`:

```sh
npm install @omnicajs/rpc
```

## Usage

Use this package when you need direct control over an RPC connection between two JavaScript contexts. A transport must provide the same shape as `MessageEndpoint`: `postMessage()`, `addEventListener('message', ...)`, and `removeEventListener('message', ...)`.

### `createEndpoint()`

The main export is `createEndpoint()`. It wraps a message transport and returns an `Endpoint`, which can expose local methods and call methods exposed by the endpoint on the other side.

```ts
import {createEndpoint} from '@omnicajs/rpc';

interface WorkerApi {
  sayHello(): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker);
```

The worker creates the sibling endpoint with the same transport API:

```ts
import {createEndpoint} from '@omnicajs/rpc';

const endpoint = createEndpoint(self);
```

An endpoint needs local methods before the sibling can call anything. In the worker:

```ts
import {createEndpoint} from '@omnicajs/rpc';

const endpoint = createEndpoint(self);

endpoint.expose({sayHello});

function sayHello() {
  return 'Hey :)';
}
```

The main thread can then call the exposed method:

```ts
import {createEndpoint} from '@omnicajs/rpc';

interface WorkerApi {
  sayHello(): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker);

endpoint.call.sayHello().then((result) => console.log(`They said: ${result}`));
```

Calls made through `endpoint.call` are sent over `postMessage`, so their results are always asynchronous. A synchronous exposed function is still observed as a `Promise` by the caller.

By default, `call` is a [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) that forwards method access to the sibling endpoint. In environments without `Proxy`, or when you want to restrict the callable surface, pass `callable` when creating the endpoint:

```ts
import {createEndpoint} from '@omnicajs/rpc';

interface WorkerApi {
  sayHello(): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker, {
  callable: ['sayHello'],
});

endpoint.call.sayHello().then((result) => console.log(`They said: ${result}`));
```

Arguments can include callbacks. The receiving endpoint gets a function proxy that calls back to the original context:

```ts
// worker.ts
import {createEndpoint, type SafeRpcArgument} from '@omnicajs/rpc';

const endpoint = createEndpoint(self);

endpoint.expose({sayHello});

interface User {
  fullName(): string;
}

async function sayHello(user: SafeRpcArgument<User>) {
  return `Hey, ${await user.fullName()}!`;
}
```

```ts
// main thread
import {createEndpoint} from '@omnicajs/rpc';

interface User {
  fullName(): string;
}

interface WorkerApi {
  sayHello(user: User): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker);

const user = {
  fullName() {
    return 'Shoppy the bag';
  },
};

endpoint.call
  .sayHello(user)
  .then((result) => console.log(`They said: ${result}`));
```

The worker sees `user.fullName()` as an asynchronous call because it crosses the endpoint boundary.

### `Endpoint`

An `Endpoint` controls the methods exposed to its sibling and the methods it can call on that sibling.

#### `Endpoint#call`

`call` exposes methods available on the sibling endpoint. If `callable` is not configured, `call` uses a proxy and unknown method names fail asynchronously when the sibling endpoint handles the message. If `callable` is configured, only the listed methods exist on `call` until more are added with [`Endpoint#callable()`](#endpointcallable).

```ts
import {createEndpoint} from '@omnicajs/rpc';

interface WorkerApi {
  sayHello(name: string): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker, {
  callable: ['sayHello'],
});

endpoint.call.sayHello('Ada').then(console.log);
```

With TypeScript, pass the sibling API as the type parameter to `createEndpoint()`. The `call` property then checks method names, argument types, and asynchronous return values.

```ts
import {createEndpoint} from '@omnicajs/rpc';

interface WorkerApi {
  sayHello(name: string): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker, {
  callable: ['sayHello'],
});

// Type error: sayGoodbye is not defined.
endpoint.call.sayGoodbye().then(console.log);

// Type error: sayHello expects a string argument.
endpoint.call.sayHello().then(console.log);
```

#### `Endpoint#expose()`

`expose()` registers local methods that the sibling can call through its `call` property. Passing `undefined` for a method removes it from the exposed API.

```ts
import {createEndpoint, type SafeRpcArgument} from '@omnicajs/rpc';

const endpoint = createEndpoint(self);

endpoint.expose({sayHello});

interface User {
  fullName(): string;
}

async function sayHello(user: SafeRpcArgument<User>) {
  return `Hey, ${await user.fullName()}!`;
}
```

`SafeRpcArgument<T>` is useful for exposed method arguments because callbacks received from another endpoint may return a promise even when the original local function was synchronous.

#### `Endpoint#callable()`

Endpoints created with `callable` expose only the configured methods on `call`. Use `callable()` to add more callable method names later:

```ts
import {createEndpoint} from '@omnicajs/rpc';

interface WorkerApi {
  sayGoodbye(): string;
}

const worker = new Worker('worker.js');
const endpoint = createEndpoint<WorkerApi>(worker, {
  callable: [],
});

endpoint.callable('sayGoodbye');

endpoint.call.sayGoodbye().then(console.log);
```

If the endpoint was created without a `callable` array, `callable()` does nothing because the proxy-based `call` object already accepts any method name.

#### `Endpoint#terminate()`

`terminate()` sends a termination message to the sibling endpoint, clears local endpoint state, removes the message listener, releases encoder state, and calls `terminate()` on the transport when that method exists.

#### `Endpoint#replace()`

`replace()` swaps the transport used by an endpoint. It removes the listener from the old transport, attaches it to the new transport, and sends future messages through the new transport. Use this only when both sides of the connection have been moved to compatible transports.

## Memory Management

Function proxies need bookkeeping on both endpoints. When a function crosses the endpoint boundary, the sender stores it under an identifier, and the receiver creates a proxy function for that identifier. The proxy sends a message back to the original endpoint when it is called.

By default, callbacks received during a remote call are retained only for the lifetime of that call. When the call finishes, the endpoint releases those temporary proxies.

```ts
// worker.ts
import {createEndpoint, type SafeRpcArgument} from '@omnicajs/rpc';

const endpoint = createEndpoint(self);

endpoint.expose({sayHello});

interface User {
  fullName(): string;
}

async function sayHello(user: SafeRpcArgument<User>) {
  // user.fullName is retained while this call is running.
  return `Hey, ${await user.fullName()}!`;
  // After the result is sent, the temporary proxy is released.
}
```

If you store a received function or an object containing received functions after the call finishes, retain it manually.

### `retain()`

Use `retain()` to prevent automatic release. By default, it deeply traverses arrays and plain objects and retains every manageable value it finds.

```ts
import {retain, type SafeRpcArgument} from '@omnicajs/rpc';

interface User {
  fullName(): string;
}

const allUsers = new Set<SafeRpcArgument<User>>();

async function sayHello(user: SafeRpcArgument<User>) {
  allUsers.add(user);
  retain(user);

  return `Hey, ${await user.fullName()}!`;
}
```

A manually retained value stays retained until the endpoint terminates or matching `release()` calls are made.

### `release()`

Call `release()` when a retained value is no longer needed. Like `retain()`, it deeply traverses arrays and plain objects by default.

```ts
import {release, type SafeRpcArgument} from '@omnicajs/rpc';

interface User {
  fullName(): string;
}

const allUsers = new Set<SafeRpcArgument<User>>();

function removeUser(user: SafeRpcArgument<User>) {
  allUsers.delete(user);
  release(user);
}
```

After a proxy is fully released, calling it throws `FunctionReleasedError`.

## Argument Values

The default encoder supports these values consistently:

- Strings, numbers, booleans, `null`, and `undefined`
- Arrays containing supported values
- Plain objects, including null-prototype objects, whose properties contain supported values
- Functions inside arrays or plain objects; these become asynchronous proxies when received by the other endpoint

Other objects, such as `Date`, `Map`, `Set`, `URL`, `RegExp`, `ArrayBuffer`, typed arrays, and class instances, are passed to the underlying transport without normalization. They can work when the transport can clone them, but `@omnicajs/rpc` does not traverse them for nested functions and does not preserve class behavior beyond what the transport itself preserves.

Object identity is not part of the RPC contract. Shared references are decoded as separate values, and circular references are not reconstructed.

## Adapters

The package includes adapters for common `postMessage` transports.

### `fromWebWorker()`

`fromWebWorker()` adapts a browser `Worker`:

```ts
import {createEndpoint, fromWebWorker} from '@omnicajs/rpc';

const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});
const endpoint = createEndpoint(fromWebWorker(worker));
```

### `fromMessagePort()`

`fromMessagePort()` adapts a `MessagePort`:

```ts
import {createEndpoint, fromMessagePort} from '@omnicajs/rpc';

const channel = new MessageChannel();
const endpoint = createEndpoint(fromMessagePort(channel.port2));
```

### `fromIframe()`

`fromIframe()` adapts a child `iframe` from the parent window:

```ts
import {createEndpoint, fromIframe} from '@omnicajs/rpc';

const iframe = document.createElement('iframe');
iframe.src = '/my-iframe-page';
document.body.append(iframe);

const endpoint = createEndpoint(fromIframe(iframe));

const endpointWithoutDomRemoval = createEndpoint(
  fromIframe(iframe, {terminate: false}),
);
```

Pass `targetOrigin` to restrict the target origin used by `postMessage`:

```ts
const endpoint = createEndpoint(
  fromIframe(iframe, {targetOrigin: 'https://example.com'}),
);
```

### `fromInsideIframe()`

`fromInsideIframe()` adapts the parent window from inside a child `iframe`:

```ts
import {createEndpoint, fromInsideIframe} from '@omnicajs/rpc';

const endpoint = createEndpoint(fromInsideIframe());
```

Pass `targetOrigin` when the iframe should communicate with a specific parent origin:

```ts
const endpoint = createEndpoint(
  fromInsideIframe({targetOrigin: 'https://example.com'}),
);
```

## MessagePort Polyfill

The `@omnicajs/rpc/polyfill` entry provides a small in-memory `MessagePort` implementation for tests and non-browser environments that need a paired message channel.

```ts
import {createEndpoint, fromMessagePort} from '@omnicajs/rpc';
import {MessagePortPolyfill, pair} from '@omnicajs/rpc/polyfill';

const port1 = new MessagePortPolyfill();
const port2 = new MessagePortPolyfill();
pair(port1, port2);

const endpoint = createEndpoint(fromMessagePort(port1));
```
