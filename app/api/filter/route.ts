import { NextRequest, NextResponse } from 'next/server';

async function getPrisma() {
  const { default: prisma } = await import('../../../lib/prisma');
  return prisma;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegramId, name, type, criteria } = body;

    if (!telegramId) {
      return NextResponse.json(
        {
          error: 'telegramId обязателен',
        },
        { status: 400 },
      );
    }

    const prisma = await getPrisma();

    let user = await prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });

    if (!user) {
      console.log('User не ненайден');

      let firstname = 'User';
      let username = '';

      const tgHeaders = req.headers.get('x-telegram-user');
      if (tgHeaders) {
        try {
          const data = JSON.parse(tgHeaders);
          firstname = data.first_name || 'User';
          username = data.username || '';
        } catch (e) {}
      }

      user = await prisma.user.create({
        data: {
          telegramId: telegramId.toString(),
          firstName: firstname,
          username: username,
          chatId: telegramId.toString(),
        },
      });
      console.log('User успешно создан');
    } else {
      console.log('User найден', user.id);
    }

    if (!user) {
      throw new Error('Не удалось создать или найти пользователя');
    }

    const processedCriteria = {
      ...criteria,
      rooms: criteria.rooms?.map((r: any) => r.toString()),
    };

    const filter = await prisma.filter.create({
      data: {
        userId: user.id,
        name: name || `Поиск ${type === 'rent' ? 'аренды' : 'продажи'}`,
        type: type || 'rent',
        criteria: processedCriteria,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      filter: {
        id: filter.id,
        name: filter.name,
        type: filter.type,
        criteria: filter.criteria,
        isActive: filter.isActive,
      },
    });
  } catch (error: any) {
    console.error('Error API', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('📥 [API] GET /api/filter');

  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');

    console.log('🔍 telegramId из запроса:', telegramId);

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId обязателен' }, { status: 400 });
    }

    const prisma = await getPrisma();

    // Ищем пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });

    console.log('👤 Найден пользователь:', user?.id);

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Получаем фильтры
    const filters = await prisma.filter.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: {
        createAt: 'desc',
      },
    });

    console.log(`✅ Найдено ${filters.length} фильтров`);

    return NextResponse.json({
      success: true,
      filters: filters,
      count: filters.length,
    });
  } catch (error: any) {
    console.error('❌ Ошибка GET /api/filter:', error);
    return NextResponse.json({ error: error.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}
