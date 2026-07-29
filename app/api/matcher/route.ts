// cron-job.org ждёт ответ не дольше 30 с — держим цикл в этом бюджете.
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { runMatching } from '@/lib/matcher/matcher';

// Этот route оставляем для ручного запуска / тестирования
// Для автоматического cron используй /api/cron

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.MATCHER_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runMatching();
    return NextResponse.json({
      success: true,
      message: 'Matching completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Matcher error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Matcher API is working. Use POST to trigger.',
    timestamp: new Date().toISOString(),
  });
}
