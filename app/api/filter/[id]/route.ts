import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// DELETE — удалить фильтр
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!id) {
      return NextResponse.json({ message: 'Id фильтра не передан' }, { status: 400 });
    }

    // Удаляем связанные уведомления сначала
    await prisma.notification.deleteMany({ where: { filterId: Number(id) } });

    const deleted = await prisma.filter.delete({ where: { id: Number(id) } });

    return NextResponse.json({ message: 'Фильтр удалён', filter: deleted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Ошибка при удалении фильтра', error }, { status: 500 });
  }
}

// PATCH — обновить фильтр (isActive, name, criteria и т.д.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!id) {
      return NextResponse.json({ message: 'Id фильтра не передан' }, { status: 400 });
    }

    const body = await req.json();
    const { isActive, name, type, criteria } = body;

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (criteria !== undefined) updateData.criteria = criteria;

    const updated = await prisma.filter.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json({ success: true, filter: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Ошибка при обновлении фильтра', error }, { status: 500 });
  }
}

// GET — получить один фильтр по id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const filter = await prisma.filter.findUnique({ where: { id: Number(id) } });
    if (!filter) {
      return NextResponse.json({ message: 'Фильтр не найден' }, { status: 404 });
    }
    return NextResponse.json({ success: true, filter });
  } catch (error) {
    return NextResponse.json({ message: 'Ошибка', error }, { status: 500 });
  }
}
