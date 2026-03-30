// app/api/bot/route.ts
import { NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.BOT_TOKEN || '';
const bot = new TelegramBot(token);

// Функция для ленивого импорта Prisma
async function getPrisma() {
  // Динамический импорт гарантирует, что Prisma не загружается при сборке
  const { default: prisma } = await import('../../../lib/prisma');
  return prisma;
}

function validateSecret(request: Request) {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  return secretToken === process.env.TELEGRAM_WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  // Проверка авторизации
  if (!validateSecret(request)) {
    console.error('❌ Неавторизованный запрос');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const msg = body.message;

    // Обработка команды /start
    if (msg?.text === '/start') {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id?.toString();

      // Пытаемся сохранить в БД, но не блокируем ответ
      try {
        const prisma = await getPrisma();
        await prisma.user.upsert({
          where: { telegramId: telegramId! },
          update: { chatId: chatId.toString() },
          create: {
            telegramId: telegramId!,
            chatId: chatId.toString(),
            firstName: msg.from?.first_name,
            lastName: msg.from?.last_name,
            username: msg.from?.username,
          },
        });
      } catch (dbError) {
        console.error('❌ Ошибка БД (продолжаем выполнение):', dbError);
      }

      // Отправляем ответ в любом случае
      await bot.sendMessage(chatId, 'Привет! Я могу найти квартиру мечты', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔍 Создать фильтр',
                web_app: { url: `${process.env.APP_URL}/` },
              },
              {
                text: '📋 Мои фильтры',
                web_app: { url: `${process.env.APP_URL}/filters` },
              },
            ],
          ],
        },
      });

      console.log(`✅ Ответ отправлен пользователю ${telegramId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('❌ Ошибка в вебхуке:', error);
    return NextResponse.json({ ok: true }); // Всегда отвечаем ok
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Bot webhook endpoint is working',
    timestamp: new Date().toISOString(),
  });
}
