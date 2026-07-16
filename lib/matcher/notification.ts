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
 * Экранирует спецсимволы HTML, чтобы parse_mode: 'HTML' не падал
 * на пользовательском тексте (заголовки/описания OLX).
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * OLX отдаёт ссылку на фото с плейсхолдером `{width}x{height}`.
 * Telegram не может скачать такой URL — подставляем реальные размеры.
 */
function resolveImageUrl(image?: string | null): string | null {
  if (!image) return null;
  return image.replace('{width}x{height}', '1000x700');
}

/**
 * Форматирует сообщение для отправки (parse_mode: HTML).
 * HTML устойчивее legacy Markdown: не ломается на _ * [ ] ( ).
 */
function formatMessage(listing: Listing, filterName?: string | null): string {
  let message = '🏠 <b>Новая квартира по вашему фильтру!</b>\n\n';

  if (filterName) {
    message += `📌 <b>Фильтр:</b> ${escapeHtml(filterName)}\n\n`;
  }

  message += `<b>${escapeHtml(listing.title)}</b>\n\n`;

  // Район
  const district = listing.district || listing.rayon || 'Не указан';
  message += `📍 <b>Район:</b> ${escapeHtml(district)}\n`;
  message += `💰 <b>Цена:</b> ${escapeHtml(listing.price)}\n`;

  // Детали
  const details = [];
  if (listing.rooms) details.push(`${listing.rooms} комн.`);
  if (listing.area) details.push(`${listing.area} м²`);
  if (listing.floor && listing.totalFloors) {
    details.push(`${listing.floor}/${listing.totalFloors} эт.`);
  }

  if (details.length) {
    message += `📐 <b>Характеристики:</b> ${escapeHtml(details.join(', '))}\n`;
  }

  // Описание (первые 150 символов)
  if (listing.description) {
    const shortDesc = listing.description.substring(0, 150);
    message += `\n📝 <b>Описание:</b> ${escapeHtml(shortDesc)}...\n`;
  }

  message += `\n🔗 <a href="${escapeHtml(listing.url)}">Открыть объявление</a>`;

  return message;
}

/**
 * Отправляет уведомление пользователю.
 * Возвращает true только при успешной доставке — matcher помечает
 * объявление как отправленное лишь по факту успеха, иначе повторит
 * в следующем цикле (а не потеряет навсегда).
 */
export async function sendNotification(
  user: User,
  listing: Listing,
  filter?: Filter,
): Promise<boolean> {
  // Проверяем наличие chatId
  if (!user.chatId) {
    console.error(`❌ Нет chatId для пользователя ${user.telegramId}`);
    return false;
  }

  const message = formatMessage(listing, filter?.name);
  const image = resolveImageUrl(listing.image);

  // Попытка 1: с фото
  if (image) {
    try {
      await bot.sendPhoto(user.chatId, image, {
        caption: message,
        parse_mode: 'HTML',
      });
      console.log(`📨 Уведомление (с фото) отправлено пользователю ${user.chatId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.warn(`⚠️ sendPhoto упал (${msg}) — пробуем без фото`);
      // не выходим: фолбэк на текст ниже
    }
  }

  // Попытка 2 (фолбэк): текстовое сообщение без фото
  try {
    await bot.sendMessage(user.chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
    console.log(`📨 Уведомление (текст) отправлено пользователю ${user.chatId}`);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error(`❌ Ошибка отправки уведомления пользователю ${user.chatId}:`, msg);
    return false;
  }
}
