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
  const body = await request.json();
  if (!Number.isInteger(body.durationDays) || body.durationDays < 1) {
    return NextResponse.json(
      { error: 'durationDays must be a positive integer' },
      { status: 400 },
    );
  }
  try {
    const todo = await prisma.todo.update({
      where: { id },
      data: { durationDays: body.durationDays },
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
