import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.BOT_TOKEN!);

// 🔥 Исправляем интерфейс User - добавляем null
interface User {
  id: number;
  chatId: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  telegramId: string;
}

interface Listing {
  id: number;
  title: string;
  price: string;
  priceNumeric: number;
  district?: string | null;
  rayon?: string | null;
  rooms?: number | null;
  area?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  description?: string | null;
  url: string;
  image?: string | null;
}

interface Filter {
  id: number;
  name?: string | null;
}

/**
 * Форматирует сообщение для отправки
 */
function formatMessage(listing: Listing, filterName?: string | null): string {
  let message = '🏠 *Новая квартира по вашему фильтру!*\n\n';

  if (filterName) {
    message += `📌 *Фильтр:* ${filterName}\n\n`;
  }

  message += `*${listing.title}*\n\n`;

  // Район
  const district = listing.district || listing.rayon || 'Не указан';
  message += `📍 *Район:* ${district}\n`;
  message += `💰 *Цена:* ${listing.price}\n`;

  // Детали
  const details = [];
  if (listing.rooms) details.push(`${listing.rooms} комн.`);
  if (listing.area) details.push(`${listing.area} м²`);
  if (listing.floor && listing.totalFloors) {
    details.push(`${listing.floor}/${listing.totalFloors} эт.`);
  }

  if (details.length) {
    message += `📐 *Характеристики:* ${details.join(', ')}\n`;
  }

  // Описание (первые 150 символов)
  if (listing.description) {
    const shortDesc = listing.description.substring(0, 150);
    message += `\n📝 *Описание:* ${shortDesc}...\n`;
  }

  message += `\n🔗 [Открыть объявление](${listing.url})`;

  return message;
}

/**
 * Отправляет уведомление пользователю
 */
export async function sendNotification(user: User, listing: Listing, filter?: Filter) {
  try {
    // Проверяем наличие chatId
    if (!user.chatId) {
      console.error(`❌ Нет chatId для пользователя ${user.telegramId}`);
      return;
    }

    const message = formatMessage(listing, filter?.name);

    // Если есть фото, отправляем с фото
    if (listing.image) {
      await bot.sendPhoto(user.chatId, listing.image, {
        caption: message,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.sendMessage(user.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      });
    }

    console.log(`📨 Уведомление отправлено пользователю ${user.chatId}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error(`❌ Ошибка отправки уведомления пользователю ${user.chatId}:`, errorMessage);
  }
}
