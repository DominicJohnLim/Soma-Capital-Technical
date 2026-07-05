import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { wouldCreateCycle } from '@/lib/scheduling';

interface Params {
  params: { id: string };
}

// On Postgres (production) use a serializable transaction so two concurrent
// additions can't each pass the cycle check and together form a cycle. SQLite
// (local dev) serializes writes already, so the in-transaction check suffices.
const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

export async function POST(request: Request, { params }: Params) {
  const todoId = parseInt(params.id);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const dependsOnId = Number.isInteger(body.dependsOnId) ? (body.dependsOnId as number) : NaN;
  if (isNaN(todoId) || isNaN(dependsOnId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const [todo, dependsOn] = await Promise.all([
          tx.todo.findUnique({ where: { id: todoId } }),
          tx.todo.findUnique({ where: { id: dependsOnId } }),
        ]);
        if (!todo || !dependsOn) {
          return { status: 404 as const, error: 'Todo not found' };
        }

        // Read the graph inside the transaction so the cycle check and the
        // insert are atomic with respect to other writers.
        const todos = await tx.todo.findMany({
          include: { dependencies: { select: { dependsOnId: true } } },
        });
        const nodes = todos.map((t) => ({
          id: t.id,
          durationDays: t.durationDays,
          dependsOn: t.dependencies.map((d) => d.dependsOnId),
        }));
        if (wouldCreateCycle(nodes, todoId, dependsOnId)) {
          return {
            status: 400 as const,
            error: `Cannot make "${todo.title}" depend on "${dependsOn.title}": that would create a circular dependency`,
          };
        }

        const dep = await tx.todoDependency.create({ data: { todoId, dependsOnId } });
        return { status: 201 as const, dep };
      },
      isPostgres ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : undefined,
    );

    if (result.status !== 201) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.dep, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
      }
      // Serialization failure under concurrent conflicting edits — safe to retry.
      if (e.code === 'P2034') {
        return NextResponse.json(
          { error: 'That dependency conflicted with a simultaneous edit — please try again' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Error adding dependency' }, { status: 500 });
  }
}
