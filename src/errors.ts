import type {EndpointErrorKind} from './types';

export class CallAfterTerminateError extends Error {
  readonly kind: EndpointErrorKind = 'call-after-terminate';

  constructor() {
    super('You attempted to call a function on a terminated web worker.');
    this.name = 'CallAfterTerminateError';
  }
}

export class FunctionReleasedError extends Error {
  readonly kind: EndpointErrorKind = 'function-already-released';
  readonly state: 'released' | 'revoked';

  constructor(state: 'released' | 'revoked') {
    super(
      state === 'released'
        ? 'You attempted to call a function that was already released.'
        : 'You attempted to call a function that was already revoked.',
    );
    this.name = 'FunctionReleasedError';
    this.state = state;
  }
}

export class NoExposedMethodError extends Error {
  readonly kind: EndpointErrorKind = 'no-exposed-method';
  readonly method: string;

  constructor(method: string | number) {
    super(`No '${method}' method is exposed on this endpoint`);
    this.name = 'NoExposedMethodError';
    this.method = String(method);
  }
}
