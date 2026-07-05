import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeSchedule, addDays, CycleError, Schedule } from '@/lib/scheduling';

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
    // If concurrent edits ever sneak a cycle past the add-time check, keep the
    // app usable (schedule fields zeroed) so the offending edge can be removed.
    let schedule: Schedule;
    let cyclic = false;
    try {
      schedule = computeSchedule(nodes);
    } catch (e) {
      if (!(e instanceof CycleError)) throw e;
      cyclic = true;
      schedule = {
        tasks: Object.fromEntries(
          nodes.map((n) => [
            n.id,
            {
              id: n.id,
              earliestStartDay: 0,
              earliestFinishDay: n.durationDays,
              latestStartDay: 0,
              latestFinishDay: n.durationDays,
              slackDays: 0,
              isCritical: false,
            },
          ]),
        ),
        criticalPath: [],
        totalDurationDays: 0,
      };
    }
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
        slackDays: s.slackDays,
        isCritical: s.isCritical,
      };
    });

    return NextResponse.json({
      tasks,
      criticalPath: schedule.criticalPath,
      totalDurationDays: schedule.totalDurationDays,
      projectStartDate: projectStart.toISOString(),
      cyclic,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error computing schedule' }, { status: 500 });
  }
}
