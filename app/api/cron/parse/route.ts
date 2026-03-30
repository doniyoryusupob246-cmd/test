import { NextRequest, NextResponse } from 'next/server';
import { runParser } from '@/lib/parser/olx-parser';

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
  console.log('⏰ [CRON/PARSE] Запуск парсера:', new Date().toISOString());

  try {
    const result = await runParser();
    const duration = Date.now() - startTime;

    console.log(`✅ [CRON/PARSE] Парсер завершён за ${duration}ms`);

    return NextResponse.json({
      success: true,
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [CRON/PARSE] Ошибка:', error);

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
    message: 'Parser cron endpoint is alive',
    timestamp: new Date().toISOString(),
  });
}
