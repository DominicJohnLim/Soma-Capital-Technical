import { describe, it, expect } from 'vitest';
import { isOverdue } from '@/lib/dates';

const now = new Date('2026-07-04T15:30:00');

describe('isOverdue', () => {
  it('is true for a due date before today', () => {
    expect(isOverdue('2026-07-03', now)).toBe(true);
  });

  it('is false for a due date today (date-only comparison)', () => {
    expect(isOverdue('2026-07-04T00:00:00Z', now)).toBe(false);
  });

  it('is false for a future due date', () => {
    expect(isOverdue('2026-07-05', now)).toBe(false);
  });

  it('is false when unset', () => {
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
  });
});
