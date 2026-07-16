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

interface ListingForMatch {
  priceNumeric: number;
  rooms: number | null;
  area: number | null;
  floor: number | null;
  totalFloors: number | null;
}

function parseCriteria(criteria: unknown): FilterCriteria {
  if (typeof criteria === 'string') {
    try {
      criteria = JSON.parse(criteria);
    } catch {
      return { type: 'rent' };
    }
  }
  if (!criteria || typeof criteria !== 'object') return { type: 'rent' };

  const data = criteria as Record<string, unknown>;

  return {
    type: data.type === 'sale' ? 'sale' : 'rent',
    district: typeof data.district === 'string' && data.district ? data.district : undefined,
    priceMin: typeof data.priceMin === 'number' ? data.priceMin : undefined,
    priceMax: typeof data.priceMax === 'number' ? data.priceMax : undefined,
    rooms:
      Array.isArray(data.rooms) && data.rooms.length > 0
        ? data.rooms
            .filter((r: unknown) => r !== undefined && r !== null && r !== 'undefined')
            .map(String)
        : undefined,
    areaMin: typeof data.areaMin === 'number' ? data.areaMin : undefined,
    areaMax: typeof data.areaMax === 'number' ? data.areaMax : undefined,
    floorMin: typeof data.floorMin === 'number' ? data.floorMin : undefined,
    floorMax: typeof data.floorMax === 'number' ? data.floorMax : undefined,
    totalFloorsMainMin:
      typeof data.totalFloorsMainMin === 'number' ? data.totalFloorsMainMin : undefined,
    totalFloorsMainMax:
      typeof data.totalFloorsMainMax === 'number' ? data.totalFloorsMainMax : undefined,
  };
}

function matchesFilter(
  listing: ListingForMatch,
  criteria: FilterCriteria,
): { match: boolean; reason?: string } {
  // Цена
  if (listing.priceNumeric > 0) {
    if (criteria.priceMin && listing.priceNumeric < criteria.priceMin) {
      return { match: false, reason: `цена ниже: ${listing.priceNumeric} < ${criteria.priceMin}` };
    }
    if (criteria.priceMax && listing.priceNumeric > criteria.priceMax) {
      return { match: false, reason: `цена выше: ${listing.priceNumeric} > ${criteria.priceMax}` };
    }
  } else {
    if (criteria.priceMin || criteria.priceMax) {
      return { match: false, reason: `priceNumeric=0` };
    }
  }

  // Комнаты
  if (criteria.rooms && criteria.rooms.length > 0 && listing.rooms != null) {
    const listingRooms = listing.rooms;
    const roomsMatch = criteria.rooms.some((room: string) => {
      if (room === '5+') return listingRooms >= 5;
      return listingRooms === parseInt(room);
    });
    if (!roomsMatch) {
      return {
        match: false,
        reason: `комнаты: фильтр=[${criteria.rooms}] объявление=${listing.rooms}`,
      };
    }
  }

  // Площадь
  if (criteria.areaMin && listing.area && listing.area < criteria.areaMin)
    return { match: false, reason: `площадь мала: ${listing.area} < ${criteria.areaMin}` };
  if (criteria.areaMax && listing.area && listing.area > criteria.areaMax)
    return { match: false, reason: `площадь велика: ${listing.area} > ${criteria.areaMax}` };

  // Этаж
  if (criteria.floorMin && listing.floor && listing.floor < criteria.floorMin)
    return { match: false, reason: `этаж низкий: ${listing.floor} < ${criteria.floorMin}` };
  if (criteria.floorMax && listing.floor && listing.floor > criteria.floorMax)
    return { match: false, reason: `этаж высокий: ${listing.floor} > ${criteria.floorMax}` };

  // Этажность
  if (
    criteria.totalFloorsMainMin &&
    listing.totalFloors &&
    listing.totalFloors < criteria.totalFloorsMainMin
  )
    return { match: false, reason: `этажность мала` };
  if (
    criteria.totalFloorsMainMax &&
    listing.totalFloors &&
    listing.totalFloors > criteria.totalFloorsMainMax
  )
    return { match: false, reason: `этажность велика` };

  return { match: true };
}

export async function runMatching() {
  console.log('🔍 [Matcher] Начинаем матчинг...', new Date().toISOString());

  try {
    const filters = await prisma.filter.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    if (filters.length === 0) {
      console.log('📭 Нет активных фильтров');
      return;
    }

    console.log(`🎯 Активных фильтров: ${filters.length}`);

    let matchedCount = 0;

    for (const filter of filters) {
      const criteria = parseCriteria(filter.criteria);

      console.log(`\n📋 Фильтр #${filter.id} "${filter.name}"`);
      console.log(
        `   type=${filter.type} district="${criteria.district}" price=${criteria.priceMin}-${criteria.priceMax} rooms=[${criteria.rooms}]`,
      );

      const alreadySentNotifications = await prisma.notification.findMany({
        where: { userId: filter.userId },
        select: { listingId: true },
      });

      const alreadySentIds = new Set<number>(
        alreadySentNotifications.map((n) => n.listingId).filter((id): id is number => id !== null),
      );

      const excludeIds: number[] = alreadySentIds.size > 0 ? Array.from(alreadySentIds) : [-1];

      // Фильтруем по району прямо в Prisma
      const districtFilter = criteria.district
        ? {
            OR: [
              { district: { contains: criteria.district, mode: 'insensitive' as const } },
              { rayon: { contains: criteria.district, mode: 'insensitive' as const } },
            ],
          }
        : {};

      // Берём 200 самых свежих подходящих объявлений (desc + take)
      const candidates = await prisma.listing.findMany({
        where: {
          type: filter.type,
          NOT: { id: { in: excludeIds } },
          ...districtFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      // Отправляем от старых к новым, чтобы самое свежее объявление
      // пришло в Telegram последним (внизу чата).
      candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      console.log(
        `   кандидатов=${candidates.length} (с районом "${criteria.district}"), уже отправлено=${alreadySentIds.size}`,
      );

      const rejectReasons: Record<string, number> = {};
      let filterMatchCount = 0;

      for (const listing of candidates) {
        if (alreadySentIds.has(listing.id)) continue;

        try {
          const result = matchesFilter(listing, criteria);

          if (result.match) {
            filterMatchCount++;
            console.log(`  ✅ СОВПАДЕНИЕ! → "${listing.title}" $${listing.priceNumeric}`);

            const sent = await sendNotification(
              {
                id: filter.user.id,
                chatId: filter.user.chatId,
                firstName: filter.user.firstName,
                lastName: filter.user.lastName,
                username: filter.user.username,
                telegramId: filter.user.telegramId,
              },
              listing,
              filter,
            );

            // Помечаем как отправленное ТОЛЬКО при успехе.
            // Иначе объявление останется и уйдёт в следующем цикле,
            // а не потеряется навсегда.
            if (!sent) {
              console.warn(`  ⏭️ Отправка не удалась — повторим в следующем цикле (listing #${listing.id})`);
              continue;
            }

            await prisma.notification.create({
              data: {
                userId: filter.userId,
                filterId: filter.id,
                listingId: listing.id,
              },
            });

            alreadySentIds.add(listing.id);
            matchedCount++;

            // Небольшая пауза между отправками, чтобы не ловить 429 от Telegram.
            await new Promise((r) => setTimeout(r, 500));
          } else {
            const key = (result.reason || 'неизвестно').split(':')[0];
            rejectReasons[key] = (rejectReasons[key] || 0) + 1;
          }
        } catch (err) {
          console.error(`  ❌ Ошибка листинг #${listing.id}:`, err);
        }
      }

      console.log(`   Совпало: ${filterMatchCount}`);
      if (Object.keys(rejectReasons).length > 0) {
        console.log(`   Причины отсева:`, JSON.stringify(rejectReasons));
      }
    }

    console.log(`\n🎉 Матчинг завершён! Уведомлений: ${matchedCount}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Критическая ошибка матчинга:', msg);
  }
}
