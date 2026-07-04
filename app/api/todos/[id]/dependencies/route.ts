import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadTaskNodes } from '@/lib/graph';
import { wouldCreateCycle } from '@/lib/scheduling';

interface Params {
  params: { id: string };
}

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

  const [todo, dependsOn] = await Promise.all([
    prisma.todo.findUnique({ where: { id: todoId } }),
    prisma.todo.findUnique({ where: { id: dependsOnId } }),
  ]);
  if (!todo || !dependsOn) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const tasks = await loadTaskNodes();
  if (wouldCreateCycle(tasks, todoId, dependsOnId)) {
    return NextResponse.json(
      {
        error: `Cannot make "${todo.title}" depend on "${dependsOn.title}": that would create a circular dependency`,
      },
      { status: 400 },
    );
  }

  try {
    const dep = await prisma.todoDependency.create({ data: { todoId, dependsOnId } });
    return NextResponse.json(dep, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
  }
}
