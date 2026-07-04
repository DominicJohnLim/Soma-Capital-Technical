import { describe, it, expect } from 'vitest';
import {
  TaskNode,
  CycleError,
  wouldCreateCycle,
  topologicalSort,
  computeSchedule,
  addDays,
} from '@/lib/scheduling';

const t = (id: number, durationDays: number, dependsOn: number[] = []): TaskNode => ({
  id,
  durationDays,
  dependsOn,
});

describe('wouldCreateCycle', () => {
  it('rejects self-dependency', () => {
    expect(wouldCreateCycle([t(1, 1)], 1, 1)).toBe(true);
  });

  it('rejects direct cycle', () => {
    // 2 depends on 1; adding "1 depends on 2" closes the loop
    const tasks = [t(1, 1), t(2, 1, [1])];
    expect(wouldCreateCycle(tasks, 1, 2)).toBe(true);
  });

  it('rejects transitive cycle', () => {
    // 2 depends on 1, 3 depends on 2; adding "1 depends on 3" => 1 -> 2 -> 3 -> 1
    const tasks = [t(1, 1), t(2, 1, [1]), t(3, 1, [2])];
    expect(wouldCreateCycle(tasks, 1, 3)).toBe(true);
  });

  it('allows a redundant but acyclic edge', () => {
    const tasks = [t(1, 1), t(2, 1, [1]), t(3, 1, [2])];
    expect(wouldCreateCycle(tasks, 3, 1)).toBe(false);
  });
});

describe('topologicalSort', () => {
  it('orders a diamond with prerequisites first', () => {
    const tasks = [t(1, 1), t(2, 1, [1]), t(3, 1, [1]), t(4, 1, [2, 3])];
    const order = topologicalSort(tasks);
    expect(order).toHaveLength(4);
    expect(order[0]).toBe(1);
    expect(order[3]).toBe(4);
  });

  it('throws CycleError on a cyclic graph', () => {
    const tasks = [t(1, 1, [2]), t(2, 1, [1])];
    expect(() => topologicalSort(tasks)).toThrow(CycleError);
  });

  it('handles empty input', () => {
    expect(topologicalSort([])).toEqual([]);
  });
});

describe('computeSchedule', () => {
  it('chains earliest starts through prerequisites', () => {
    const s = computeSchedule([t(1, 2), t(2, 3, [1])]);
    expect(s.tasks[1]).toMatchObject({ earliestStartDay: 0, earliestFinishDay: 2 });
    expect(s.tasks[2]).toMatchObject({ earliestStartDay: 2, earliestFinishDay: 5 });
    expect(s.totalDurationDays).toBe(5);
    expect(s.criticalPath).toEqual([1, 2]);
  });

  it('takes the max over multiple prerequisites and finds the longest path', () => {
    // diamond: 1(1d); 2(5d) after 1; 3(2d) after 1; 4(1d) after 2 and 3
    const s = computeSchedule([t(1, 1), t(2, 5, [1]), t(3, 2, [1]), t(4, 1, [2, 3])]);
    expect(s.tasks[4].earliestStartDay).toBe(6);
    expect(s.totalDurationDays).toBe(7);
    expect(s.criticalPath).toEqual([1, 2, 4]);
    expect(s.tasks[3].isCritical).toBe(false);
    expect(s.tasks[2].isCritical).toBe(true);
  });

  it('handles disconnected components', () => {
    const s = computeSchedule([t(1, 2), t(2, 4)]);
    expect(s.totalDurationDays).toBe(4);
    expect(s.criticalPath).toEqual([2]);
  });

  it('handles an empty graph', () => {
    const s = computeSchedule([]);
    expect(s.totalDurationDays).toBe(0);
    expect(s.criticalPath).toEqual([]);
  });
});

describe('addDays', () => {
  it('adds whole days in UTC', () => {
    expect(addDays(new Date('2026-07-04T00:00:00Z'), 2).toISOString()).toBe(
      '2026-07-06T00:00:00.000Z',
    );
  });
});
