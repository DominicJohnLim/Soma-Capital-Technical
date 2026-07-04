import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: { id: string; depId: string };
}

export async function DELETE(_request: Request, { params }: Params) {
  const todoId = parseInt(params.id);
  const dependsOnId = parseInt(params.depId);
  if (isNaN(todoId) || isNaN(dependsOnId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  await prisma.todoDependency.deleteMany({ where: { todoId, dependsOnId } });
  return NextResponse.json({ message: 'Dependency removed' });
}
