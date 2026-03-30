import { prisma } from '@/lib/prisma';
import { sendNotification } from './notification';

interface FilterCriteria {
  type: 'rent' | 'sale';
  district?: string;
  priceMin?: number;
  priceMax?: number;
  rooms?: string[];
  areaMin?: number;
  areaMax?: number;
  floorMin?: number;
  floorMax?: number;
  totalFloorsMainMin?: number;
  totalFloorsMainMax?: number;
  planning?: string[];
  renovation?: string[];
  bathroom?: string[];
  furniture?: string[];
}

/**
 * Безопасно парсит критерии фильтра
 */
function parseCriteria(criteria: any): FilterCriteria {
  // Если criteria это строка, парсим JSON
  if (typeof criteria === 'string') {
    try {
      criteria = JSON.parse(criteria);
    } catch (error) {
      console.error('Ошибка парсинга criteria:', error);
      return { type: 'rent' }; // дефолтное значение
    }
  }

  // Если criteria null или undefined
  if (!criteria || typeof criteria !== 'object') {
    return { type: 'rent' };
  }

  // Безопасно извлекаем значения
  return {
    type: criteria.type === 'sale' ? 'sale' : 'rent',
    district: criteria.district || undefined,
    priceMin: typeof criteria.priceMin === 'number' ? criteria.priceMin : undefined,
    priceMax: typeof criteria.priceMax === 'number' ? criteria.priceMax : undefined,
    rooms: Array.isArray(criteria.rooms) ? criteria.rooms.map(String) : undefined,
    areaMin: typeof criteria.areaMin === 'number' ? criteria.areaMin : undefined,
    areaMax: typeof criteria.areaMax === 'number' ? criteria.areaMax : undefined,
    floorMin: typeof criteria.floorMin === 'number' ? criteria.floorMin : undefined,
    floorMax: typeof criteria.floorMax === 'number' ? criteria.floorMax : undefined,
    totalFloorsMainMin:
      typeof criteria.totalFloorsMainMin === 'number' ? criteria.totalFloorsMainMin : undefined,
    totalFloorsMainMax:
      typeof criteria.totalFloorsMainMax === 'number' ? criteria.totalFloorsMainMax : undefined,
    planning: Array.isArray(criteria.planning) ? criteria.planning.map(String) : undefined,
    renovation: Array.isArray(criteria.renovation) ? criteria.renovation.map(String) : undefined,
    bathroom: Array.isArray(criteria.bathroom) ? criteria.bathroom.map(String) : undefined,
    furniture: Array.isArray(criteria.furniture) ? criteria.furniture.map(String) : undefined,
  };
}

/**
 * Проверяет, подходит ли объявление под фильтр
 */
function matchesFilter(listing: any, criteria: FilterCriteria): boolean {
  // 1. Тип (аренда/продажа)
  if (criteria.type && listing.type !== criteria.type) {
    return false;
  }

  // 2. Район
  if (criteria.district && listing.district !== criteria.district) {
    return false;
  }

  // 3. Цена
  if (criteria.priceMin && listing.priceNumeric < criteria.priceMin) {
    return false;
  }
  if (criteria.priceMax && listing.priceNumeric > criteria.priceMax) {
    return false;
  }

  // 4. Комнаты
  if (criteria.rooms?.length && criteria.rooms.length > 0) {
    const roomsMatch = criteria.rooms.some((room) => {
      if (room === '5+') return listing.rooms >= 5;
      return listing.rooms === parseInt(room);
    });
    if (!roomsMatch) return false;
  }

  // 5. Площадь
  if (criteria.areaMin && listing.area && listing.area < criteria.areaMin) {
    return false;
  }
  if (criteria.areaMax && listing.area && listing.area > criteria.areaMax) {
    return false;
  }

  // 6. Этаж
  if (criteria.floorMin && listing.floor && listing.floor < criteria.floorMin) {
    return false;
  }
  if (criteria.floorMax && listing.floor && listing.floor > criteria.floorMax) {
    return false;
  }

  // 7. Этажность дома
  if (
    criteria.totalFloorsMainMin &&
    listing.totalFloors &&
    listing.totalFloors < criteria.totalFloorsMainMin
  ) {
    return false;
  }
  if (
    criteria.totalFloorsMainMax &&
    listing.totalFloors &&
    listing.totalFloors > criteria.totalFloorsMainMax
  ) {
    return false;
  }

  // 8. Текстовая проверка (ремонт, мебель, санузел)
  const desc = listing.description?.toLowerCase() || '';

  // Ремонт
  if (criteria.renovation?.length) {
    const renovationMap: Record<string, string[]> = {
      'Авторский проект': ['авторский', 'дизайнерский', 'проект'],
      Евроремонт: ['евроремонт', 'евро', 'дизайнерский'],
      Средний: ['средний', 'нормальный', 'хороший'],
      'Требует ремонта': ['требует ремонта', 'без ремонта', 'черновой'],
      Черновая: ['черновая', 'черновой'],
      Предчистовая: ['предчистовая', 'предчистовой'],
    };

    const hasRenovation = criteria.renovation.some((ren) => {
      const keywords = renovationMap[ren] || [ren.toLowerCase()];
      return keywords.some((kw) => desc.includes(kw));
    });
    if (!hasRenovation) return false;
  }

  // Мебель
  if (criteria.furniture?.length) {
    const furnitureKeywords = ['мебель', 'меблирована', 'обставлена', 'с мебелью'];
    const hasFurniture = furnitureKeywords.some((kw) => desc.includes(kw));

    if (criteria.furniture.includes('Да') && !hasFurniture) return false;
    if (criteria.furniture.includes('Нет') && hasFurniture) return false;
  }

  // Санузел
  if (criteria.bathroom?.length) {
    const bathroomMap: Record<string, string[]> = {
      Раздельный: ['раздельный', 'раздельный санузел'],
      Совмещённый: ['совмещенный', 'совмещённый'],
      '2+': ['2 санузла', 'два санузла', '2+ санузла'],
    };

    const hasBathroom = criteria.bathroom.some((bath) => {
      const keywords = bathroomMap[bath] || [bath.toLowerCase()];
      return keywords.some((kw) => desc.includes(kw));
    });
    if (!hasBathroom) return false;
  }

  // Планировка
  if (criteria.planning?.length) {
    const hasPlanning = criteria.planning.some((plan) => {
      const planLower = plan.toLowerCase();
      return (
        desc.includes(planLower) ||
        (planLower === 'смежная' && desc.includes('смежная')) ||
        (planLower === 'раздельная' && desc.includes('раздельная'))
      );
    });
    if (!hasPlanning) return false;
  }

  return true;
}

/**
 * Получает новые объявления (которые еще не проверялись)
 */
async function getNewListings() {
  const listings = await prisma.listing.findMany({
    where: {
      isMatched: false,
    },
    take: 100,
  });

  return listings;
}

/**
 * Запускает процесс матчинга
 */
export async function runMatching() {
  console.log('🔍 [Matcher] Начинаем матчинг...', new Date().toISOString());

  try {
    // 1. Получаем новые объявления
    const newListings = await getNewListings();

    if (newListings.length === 0) {
      console.log('📭 Нет новых объявлений для матчинга');
      return;
    }

    console.log(`📦 Найдено ${newListings.length} новых объявлений`);

    // 2. Получаем все активные фильтры пользователей
    const filters = await prisma.filter.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`🎯 Активных фильтров: ${filters.length}`);

    let matchedCount = 0;

    // 3. Для каждого объявления проверяем фильтры
    for (const listing of newListings) {
      for (const filter of filters) {
        try {
          // Проверяем, не отправляли ли уже это объявление этому пользователю
          const alreadySent = await prisma.notification.findFirst({
            where: {
              userId: filter.userId,
              listingId: listing.id,
            },
          });

          if (alreadySent) continue;

          // 🔥 БЕЗОПАСНО парсим критерии
          const criteria = parseCriteria(filter.criteria);

          // Проверяем соответствие
          if (matchesFilter(listing, criteria)) {
            console.log(
              `✅ Найдено совпадение! Фильтр: ${filter.name}, Объявление: ${listing.title}`,
            );

            const userForNotification = {
              id: filter.user.id,
              chatId: filter.user.chatId,
              firstName: filter.user.firstName,
              lastName: filter.user.lastName,
              username: filter.user.username,
              telegramId: filter.user.telegramId,
            };

            // Отправляем уведомление
            await sendNotification(userForNotification, listing, filter);

            // Сохраняем в историю
            await prisma.notification.create({
              data: {
                userId: filter.userId,
                filterId: filter.id,
                listingId: listing.id,
              },
            });

            matchedCount++;
          }
        } catch (err) {
          console.error(`❌ Ошибка при проверке фильтра ${filter.id}:`, err);
        }
      }

      // Отмечаем объявление как обработанное
      await prisma.listing.update({
        where: { id: listing.id },
        data: { isMatched: true },
      });
    }

    console.log(`🎉 Матчинг завершен! Отправлено уведомлений: ${matchedCount}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('❌ Ошибка в матчинге:', errorMessage);
  }
}
