import { mulberry32, pick, sample, shuffle } from './random';
import { isUuid, uuid } from './id';

describe('random helpers', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('shuffles without losing elements', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffle(items, mulberry32(7));
    expect(out).toHaveLength(6);
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('picks and samples', () => {
    expect(pick([], mulberry32(1))).toBeUndefined();
    expect(pick(['x'], mulberry32(1))).toBe('x');
    expect(sample([1, 2, 3], 2, mulberry32(3))).toHaveLength(2);
    expect(sample([1, 2, 3], 10, mulberry32(3))).toHaveLength(3);
  });
});

describe('uuid', () => {
  it('produces valid v4 ids', () => {
    const id = uuid();
    expect(isUuid(id)).toBe(true);
    expect(uuid()).not.toBe(id);
    expect(isUuid('nope')).toBe(false);
  });
});
