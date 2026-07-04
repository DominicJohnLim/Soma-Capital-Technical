import { prisma } from '@/lib/prisma';
import { TaskNode } from '@/lib/scheduling';

export async function loadTaskNodes(): Promise<TaskNode[]> {
  const todos = await prisma.todo.findMany({
    include: { dependencies: { select: { dependsOnId: true } } },
  });
  return todos.map((t) => ({
    id: t.id,
    durationDays: t.durationDays,
    dependsOn: t.dependencies.map((d) => d.dependsOnId),
  }));
}
