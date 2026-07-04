import React from 'react';
import { DependencyGraph } from 'soma-todo-app';

const day = (offset: number) => new Date(Date.UTC(2026, 6, 4 + offset)).toISOString();

const task = (
  id: number,
  title: string,
  durationDays: number,
  dependsOn: number[],
  startDay: number,
  isCritical: boolean,
) => ({
  id,
  title,
  createdAt: day(0),
  dueDate: null,
  imageUrl: null,
  imageAlt: null,
  durationDays,
  dependsOn,
  earliestStartDay: startDay,
  earliestStartDate: day(startDay),
  earliestFinishDate: day(startDay + durationDays),
  isCritical,
});

// Diamond project: mockups fan out to build + copy, both gate the deploy.
const diamond = [
  task(1, 'Design mockups', 1, [], 0, true),
  task(2, 'Build pages', 5, [1], 1, true),
  task(3, 'Write copy', 2, [1], 1, false),
  task(4, 'Deploy site', 1, [2, 3], 6, true),
];

export const DiamondWithCriticalPath = () => (
  <div style={{ width: 720 }}>
    <DependencyGraph tasks={diamond} criticalPath={[1, 2, 4]} />
  </div>
);

const chain = [
  task(1, 'Collect requirements', 2, [], 0, true),
  task(2, 'Draft proposal', 3, [1], 2, true),
  task(3, 'Review with client', 1, [2], 5, true),
];

export const LinearChain = () => (
  <div style={{ width: 720 }}>
    <DependencyGraph tasks={chain} criticalPath={[1, 2, 3]} />
  </div>
);

const parallel = [
  task(1, 'Book venue', 1, [], 0, true),
  task(2, 'Send invites', 2, [1], 1, true),
  task(3, 'Order catering', 1, [1], 1, false),
];

export const ParallelBranches = () => (
  <div style={{ width: 720 }}>
    <DependencyGraph tasks={parallel} criticalPath={[1, 2]} />
  </div>
);
