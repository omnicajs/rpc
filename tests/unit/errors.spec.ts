import {describe, it, expect} from 'vitest';

import {
  CallAfterTerminateError,
  FunctionReleasedError,
  NoExposedMethodError,
} from '@/errors';

describe('CallAfterTerminateError', () => {
  const err = new CallAfterTerminateError();

  it('is an instance of Error', () => {
    expect(err).toBeInstanceOf(Error);
  });

  it('has kind "call-after-terminate"', () => {
    expect(err.kind).toBe('call-after-terminate');
  });

  it('has name "CallAfterTerminateError"', () => {
    expect(err.name).toBe('CallAfterTerminateError');
  });

  it('message mentions terminated', () => {
    expect(err.message).toMatch(/terminated/);
  });
});

describe('FunctionReleasedError', () => {
  describe('state "released"', () => {
    const err = new FunctionReleasedError('released');

    it('is an instance of Error', () => {
      expect(err).toBeInstanceOf(Error);
    });

    it('has kind "function-already-released"', () => {
      expect(err.kind).toBe('function-already-released');
    });

    it('has state "released"', () => {
      expect(err.state).toBe('released');
    });

    it('has name "FunctionReleasedError"', () => {
      expect(err.name).toBe('FunctionReleasedError');
    });

    it('message mentions released', () => {
      expect(err.message).toMatch(/released/);
    });
  });

  describe('state "revoked"', () => {
    const err = new FunctionReleasedError('revoked');

    it('has state "revoked"', () => {
      expect(err.state).toBe('revoked');
    });

    it('message mentions revoked', () => {
      expect(err.message).toMatch(/revoked/);
    });
  });
});

describe('NoExposedMethodError', () => {
  const err = new NoExposedMethodError('foo');

  it('is an instance of Error', () => {
    expect(err).toBeInstanceOf(Error);
  });

  it('has kind "no-exposed-method"', () => {
    expect(err.kind).toBe('no-exposed-method');
  });

  it('has name "NoExposedMethodError"', () => {
    expect(err.name).toBe('NoExposedMethodError');
  });

  it('stores the method name', () => {
    expect(new NoExposedMethodError('myMethod').method).toBe('myMethod');
  });

  it('coerces numeric method to string', () => {
    expect(new NoExposedMethodError(42).method).toBe('42');
  });

  it('includes the method name in the message', () => {
    expect(new NoExposedMethodError('doSomething').message).toContain(
      'doSomething',
    );
  });
});
