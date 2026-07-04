import { describe, it, expect } from 'vitest';
import { parseDecomposition } from '@/lib/decompose';

describe('parseDecomposition', () => {
  it('accepts a valid decomposition', () => {
    const d = parseDecomposition({
      subtasks: [
        { title: 'Buy flour', durationDays: 1 },
        { title: 'Bake', durationDays: 2 },
      ],
      dependencies: [[1, 0]],
    });
    expect(d).not.toBeNull();
    expect(d!.subtasks).toHaveLength(2);
    expect(d!.dependencies).toEqual([[1, 0]]);
  });

  it('rejects non-object input and missing fields', () => {
    expect(parseDecomposition(null)).toBeNull();
    expect(parseDecomposition('nope')).toBeNull();
    expect(parseDecomposition({ subtasks: 'nope' })).toBeNull();
    expect(parseDecomposition({ subtasks: [], dependencies: 'nope' })).toBeNull();
  });

  it('rejects out-of-range dependency indices', () => {
    expect(
      parseDecomposition({
        subtasks: [{ title: 'A', durationDays: 1 }],
        dependencies: [[0, 5]],
      }),
    ).toBeNull();
    expect(
      parseDecomposition({
        subtasks: [{ title: 'A', durationDays: 1 }],
        dependencies: [[-1, 0]],
      }),
    ).toBeNull();
  });

  it('rejects self-dependencies', () => {
    expect(
      parseDecomposition({
        subtasks: [{ title: 'A', durationDays: 1 }],
        dependencies: [[0, 0]],
      }),
    ).toBeNull();
  });

  it('clamps invalid durations to 1', () => {
    const d = parseDecomposition({
      subtasks: [{ title: 'A', durationDays: -3 }],
      dependencies: [],
    });
    expect(d!.subtasks[0].durationDays).toBe(1);
  });

  it('rejects empty or oversized subtask lists', () => {
    expect(parseDecomposition({ subtasks: [], dependencies: [] })).toBeNull();
    expect(
      parseDecomposition({
        subtasks: Array.from({ length: 15 }, (_, i) => ({ title: `T${i}`, durationDays: 1 })),
        dependencies: [],
      }),
    ).toBeNull();
  });

  it('rejects subtasks without a usable title', () => {
    expect(
      parseDecomposition({
        subtasks: [{ title: '   ', durationDays: 1 }],
        dependencies: [],
      }),
    ).toBeNull();
  });
});
