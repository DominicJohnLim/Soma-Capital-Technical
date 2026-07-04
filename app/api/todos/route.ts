import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: { dependencies: { select: { dependsOnId: true } } },
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate
        ? new Date(`${body.dueDate}T00:00:00Z`)
        : null;
    if (dueDate && isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }
    const durationDays =
      Number.isInteger(body.durationDays) && body.durationDays >= 1 ? body.durationDays : 1;

    const todo = await prisma.todo.create({
      data: { title, dueDate, durationDays },
    });
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}
