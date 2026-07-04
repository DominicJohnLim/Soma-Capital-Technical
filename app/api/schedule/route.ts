import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeSchedule, addDays, CycleError } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: { createdAt: 'desc' },
      include: { dependencies: { select: { dependsOnId: true } } },
    });
    const nodes = todos.map((t) => ({
      id: t.id,
      durationDays: t.durationDays,
      dependsOn: t.dependencies.map((d) => d.dependsOnId),
    }));
    const schedule = computeSchedule(nodes);
    const now = new Date();
    const projectStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const tasks = todos.map((t) => {
      const s = schedule.tasks[t.id];
      return {
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
        dueDate: t.dueDate,
        imageUrl: t.imageUrl,
        imageAlt: t.imageAlt,
        durationDays: t.durationDays,
        dependsOn: t.dependencies.map((d) => d.dependsOnId),
        earliestStartDay: s.earliestStartDay,
        earliestStartDate: addDays(projectStart, s.earliestStartDay).toISOString(),
        earliestFinishDate: addDays(projectStart, s.earliestFinishDay).toISOString(),
        isCritical: s.isCritical,
      };
    });

    return NextResponse.json({
      tasks,
      criticalPath: schedule.criticalPath,
      totalDurationDays: schedule.totalDurationDays,
      projectStartDate: projectStart.toISOString(),
    });
  } catch (error) {
    if (error instanceof CycleError) {
      return NextResponse.json({ error: 'Dependency graph contains a cycle' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error computing schedule' }, { status: 500 });
  }
}
