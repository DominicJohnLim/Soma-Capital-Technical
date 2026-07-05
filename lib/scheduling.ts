export interface TaskNode {
  id: number;
  durationDays: number;
  dependsOn: number[];
}

export interface ScheduledTask {
  id: number;
  earliestStartDay: number;
  earliestFinishDay: number;
  latestStartDay: number;
  latestFinishDay: number;
  slackDays: number;
  isCritical: boolean;
}

export interface Schedule {
  tasks: Record<number, ScheduledTask>;
  criticalPath: number[];
  totalDurationDays: number;
}

export class CycleError extends Error {
  constructor(message = 'Dependency graph contains a cycle') {
    super(message);
    this.name = 'CycleError';
  }
}

// Adding "todoId depends on dependsOnId" creates a cycle iff todoId is already
// reachable from dependsOnId by walking prerequisite links.
export function wouldCreateCycle(
  tasks: TaskNode[],
  todoId: number,
  dependsOnId: number,
): boolean {
  if (todoId === dependsOnId) return true;
  const deps = new Map(tasks.map((t) => [t.id, t.dependsOn]));
  const stack = [dependsOnId];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === todoId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of deps.get(current) ?? []) stack.push(next);
  }
  return false;
}

// Kahn's algorithm; ties broken by ascending id for deterministic output.
export function topologicalSort(tasks: TaskNode[]): number[] {
  const ids = new Set(tasks.map((t) => t.id));
  const indegree = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  for (const task of tasks) {
    const prereqs = task.dependsOn.filter((d) => ids.has(d));
    indegree.set(task.id, prereqs.length);
    for (const prereq of prereqs) {
      dependents.set(prereq, [...(dependents.get(prereq) ?? []), task.id]);
    }
  }
  const queue = tasks
    .filter((t) => indegree.get(t.id) === 0)
    .map((t) => t.id)
    .sort((a, b) => a - b);
  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const dep of dependents.get(id) ?? []) {
      const remaining = indegree.get(dep)! - 1;
      indegree.set(dep, remaining);
      if (remaining === 0) queue.push(dep);
    }
  }
  if (order.length !== tasks.length) throw new CycleError();
  return order;
}

// Critical Path Method: forward pass in topological order, then backtrack the
// longest path from the task that finishes last.
export function computeSchedule(tasks: TaskNode[]): Schedule {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const order = topologicalSort(tasks);
  const scheduled: Record<number, ScheduledTask> = {};

  for (const id of order) {
    const task = byId.get(id)!;
    const prereqFinishes = task.dependsOn
      .filter((d) => scheduled[d] !== undefined)
      .map((d) => scheduled[d].earliestFinishDay);
    const earliestStartDay = prereqFinishes.length > 0 ? Math.max(...prereqFinishes) : 0;
    scheduled[id] = {
      id,
      earliestStartDay,
      earliestFinishDay: earliestStartDay + Math.max(task.durationDays, 0),
      // Filled by the backward pass below.
      latestStartDay: 0,
      latestFinishDay: 0,
      slackDays: 0,
      isCritical: false,
    };
  }

  const criticalPath: number[] = [];
  let totalDurationDays = 0;
  if (order.length > 0) {
    let endId = order[0];
    for (const id of order) {
      if (scheduled[id].earliestFinishDay > scheduled[endId].earliestFinishDay) {
        endId = id;
      }
    }
    totalDurationDays = scheduled[endId].earliestFinishDay;

    // Backward pass (CPM): walk reverse topological order. A task's latest
    // finish is the earliest latest-start among the tasks that depend on it
    // (or the project end if nothing depends on it). Slack = how far it can
    // slip without pushing the project end; zero slack means it's on a
    // critical path.
    const dependents = new Map<number, number[]>();
    for (const t of Array.from(byId.values())) {
      for (const d of t.dependsOn) {
        if (scheduled[d] !== undefined) {
          dependents.set(d, [...(dependents.get(d) ?? []), t.id]);
        }
      }
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const succs = dependents.get(id) ?? [];
      const latestFinishDay =
        succs.length > 0
          ? Math.min(...succs.map((s) => scheduled[s].latestStartDay))
          : totalDurationDays;
      const s = scheduled[id];
      s.latestFinishDay = latestFinishDay;
      s.latestStartDay = latestFinishDay - (s.earliestFinishDay - s.earliestStartDay);
      s.slackDays = s.latestStartDay - s.earliestStartDay;
    }

    // Highlight one deterministic longest path from the last-finishing task.
    let current: number | undefined = endId;
    while (current !== undefined) {
      criticalPath.unshift(current);
      scheduled[current].isCritical = true;
      const node: TaskNode = byId.get(current)!;
      current = node.dependsOn
        .filter((d) => scheduled[d] !== undefined)
        .filter((d) => scheduled[d].earliestFinishDay === scheduled[node.id].earliestStartDay)
        .sort((a, b) => a - b)[0];
    }
  }

  return { tasks: scheduled, criticalPath, totalDurationDays };
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
