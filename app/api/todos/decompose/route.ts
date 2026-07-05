import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decomposeTitle } from '@/lib/decompose';
import { searchImage } from '@/lib/pexels';
import { topologicalSort, CycleError } from '@/lib/scheduling';

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'AI decomposition requires OPENROUTER_API_KEY to be set' },
      { status: 503 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const todoId = Number.isInteger(body.todoId) ? (body.todoId as number) : NaN;
  if (isNaN(todoId)) {
    return NextResponse.json({ error: 'Invalid todoId' }, { status: 400 });
  }

  const todo = await prisma.todo.findUnique({ where: { id: todoId } });
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  try {
    const decomposition = await decomposeTitle(todo.title);

    // parseDecomposition guarantees valid indices and no self-edges, but a
    // cycle among 3+ subtasks is still possible — reject it before writing.
    const nodes = decomposition.subtasks.map((s, i) => ({
      id: i,
      durationDays: s.durationDays,
      dependsOn: decomposition.dependencies.filter(([d]) => d === i).map(([, p]) => p),
    }));
    try {
      topologicalSort(nodes);
    } catch (e) {
      if (e instanceof CycleError) {
        return NextResponse.json(
          { error: 'Model returned a cyclic decomposition — please try again' },
          { status: 502 },
        );
      }
      throw e;
    }

    const images = await Promise.all(decomposition.subtasks.map((s) => searchImage(s.title)));

    const createdIds = await prisma.$transaction(async (tx) => {
      const ids: number[] = [];
      for (let i = 0; i < decomposition.subtasks.length; i++) {
        const s = decomposition.subtasks[i];
        const created = await tx.todo.create({
          data: {
            title: s.title,
            durationDays: s.durationDays,
            imageUrl: images[i]?.url ?? null,
            imageAlt: images[i]?.alt ?? null,
          },
        });
        ids.push(created.id);
      }
      // Inter-subtask edges from the model (fresh ids — cannot reach existing todos).
      if (decomposition.dependencies.length > 0) {
        await tx.todoDependency.createMany({
          data: decomposition.dependencies.map(([dep, pre]) => ({
            todoId: ids[dep],
            dependsOnId: ids[pre],
          })),
        });
      }
      // The original task now depends on every subtask.
      await tx.todoDependency.createMany({
        data: ids.map((id) => ({ todoId, dependsOnId: id })),
      });
      return ids;
    });

    return NextResponse.json({ created: createdIds.length }, { status: 201 });
  } catch (error) {
    // Only surface messages we authored — SDK/network errors get a generic one.
    const known = new Set(['No response from model', 'Model returned an invalid decomposition']);
    const message =
      error instanceof Error && known.has(error.message)
        ? error.message
        : 'Decomposition failed — please try again';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
