import {describe, it, expect, vi} from 'vitest';

import {
  isBasicObject,
  isMemoryManageable,
  release,
  retain,
  StackFrame,
  RELEASE_METHOD,
  RETAINED_BY,
  RETAIN_METHOD,
} from '@/memory';
import type {MemoryManageable, Retainer} from '@/memory';

function createMemoryManageable(): MemoryManageable & {
  release: ReturnType<typeof vi.fn>;
  retain: ReturnType<typeof vi.fn>;
} {
  const manageable = {
    [RETAINED_BY]: new Set<Retainer>(),
    release: vi.fn(),
    retain: vi.fn(),
    [RELEASE_METHOD]() {
      this.release();
    },
    [RETAIN_METHOD]() {
      this.retain();
    },
  };

  return manageable;
}

describe('StackFrame', () => {
  it('retains and releases memory manageable values', () => {
    const stackFrame = new StackFrame();
    const manageable = createMemoryManageable();

    stackFrame.add(manageable);

    expect(manageable[RETAINED_BY].has(stackFrame)).toBe(true);
    expect(manageable.retain).toHaveBeenCalledTimes(1);

    stackFrame.release();

    expect(manageable[RETAINED_BY].has(stackFrame)).toBe(false);
    expect(manageable.release).toHaveBeenCalledTimes(1);

    stackFrame.release();

    expect(manageable.release).toHaveBeenCalledTimes(1);
  });
});

describe('memory management helpers', () => {
  it('detects memory manageable values', () => {
    expect(isMemoryManageable(createMemoryManageable())).toBe(true);
    expect(isMemoryManageable(null)).toBe(false);
    expect(isMemoryManageable({})).toBe(false);
  });

  it('retains and releases nested arrays and objects once', () => {
    const manageable = createMemoryManageable();
    const value: any = {
      nested: [manageable, manageable],
    };
    value.self = value;

    expect(retain(value)).toBe(true);
    expect(manageable.retain).toHaveBeenCalledTimes(1);

    expect(release(value)).toBe(true);
    expect(manageable.release).toHaveBeenCalledTimes(1);
  });

  it('can skip deep retain and release traversal', () => {
    const manageable = createMemoryManageable();
    const value = {manageable};

    expect(retain(value, {deep: false})).toBe(false);
    expect(release(value, {deep: false})).toBe(false);
    expect(manageable.retain).not.toHaveBeenCalled();
    expect(manageable.release).not.toHaveBeenCalled();
  });

  it('returns false for values without memory manageable entries', () => {
    expect(retain([1, {nested: 'value'}])).toBe(false);
    expect(release([1, {nested: 'value'}])).toBe(false);
  });
});

describe('isBasicObject()', () => {
  it('recognizes plain and null-prototype objects', () => {
    expect(isBasicObject({})).toBe(true);
    expect(isBasicObject(Object.create(null))).toBe(true);
  });

  it('rejects null, primitives, arrays, and class instances', () => {
    class Custom {}

    expect(isBasicObject(null)).toBe(false);
    expect(isBasicObject('value')).toBe(false);
    expect(isBasicObject([])).toBe(false);
    expect(isBasicObject(new Custom())).toBe(false);
  });
});
