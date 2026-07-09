import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const data: { durationDays?: number; done?: boolean } = {};
  if (body.durationDays !== undefined) {
    if (!Number.isInteger(body.durationDays) || (body.durationDays as number) < 1) {
      return NextResponse.json(
        { error: 'durationDays must be a positive integer' },
        { status: 400 },
      );
    }
    data.durationDays = body.durationDays as number;
  }
  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') {
      return NextResponse.json({ error: 'done must be a boolean' }, { status: 400 });
    }
    data.done = body.done;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'Provide durationDays and/or done' },
      { status: 400 },
    );
  }
  try {
    const todo = await prisma.todo.update({
      where: { id },
      data,
    });
    return NextResponse.json(todo);
  } catch {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}
