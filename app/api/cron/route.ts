import { NextRequest, NextResponse } from 'next/server';
import { runParser } from '@/lib/parser/olx-parser';
import { runMatching } from '@/lib/matcher/matcher';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === secret) return true;

  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('⏰ [CRON] Запуск полного цикла:', new Date().toISOString());

  try {
    // Шаг 1: Парсим новые объявления
    console.log('🔄 [CRON] Шаг 1: Парсер...');
    const parserResult = await runParser();

    // Шаг 2: Запускаем матчинг
    console.log('🔄 [CRON] Шаг 2: Матчинг...');
    await runMatching();

    const duration = Date.now() - startTime;
    console.log(`✅ [CRON] Полный цикл завершён за ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Full cycle completed',
      parser: parserResult,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [CRON] Ошибка:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Main cron endpoint. POST to run full cycle (parse + match).',
    endpoints: {
      'POST /api/cron': 'Полный цикл: парсер + матчинг',
      'POST /api/cron/parse': 'Только парсер',
      'POST /api/matcher': 'Только матчинг',
    },
    timestamp: new Date().toISOString(),
  });
}
