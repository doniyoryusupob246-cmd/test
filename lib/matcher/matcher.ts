import { prisma } from '@/lib/prisma';
import { sendNotification } from './notification';

/**
 * Сколько уведомлений отправляем одному фильтру за один прогон.
 * Проверяем мы все объявления, но новый фильтр может совпасть с сотнями сразу —
 * без потолка человек получил бы их одним залпом. Остальные не теряются:
 * они не помечены отправленными и уйдут в следующих циклах.
 */
const MAX_NOTIFICATIONS_PER_RUN = Number(process.env.MAX_NOTIFICATIONS_PER_RUN) || 10;

/**
 * Объявление считается свежим, если создано за последние столько часов.
 * Окно должно быть заметно больше интервала крона, иначе объявление успеет
 * состариться между прогонами и попадёт в хвост очереди вместо мгновенной отправки.
 */
const FRESH_WINDOW_HOURS = Number(process.env.FRESH_WINDOW_HOURS) || 3;

/**
 * Делит совпадения на то, что уходит прямо сейчас, и то, что ждёт следующего цикла.
 *
 * Свежие отправляем всегда — ради них бот и нужен. Остаток лимита отдаём
 * САМЫМ СТАРЫМ из очереди: если брать только свежие, накопленный хвост никогда
 * не всплывёт наверх и останется неотправленным навсегда.
 *
 * @param matched совпадения, отсортированные по убыванию даты создания
 */
export function pickBatch<T extends { createdAt: Date }>(
  matched: T[],
  limit = MAX_NOTIFICATIONS_PER_RUN,
  now = Date.now(),
): T[] {
  const freshEdge = now - FRESH_WINDOW_HOURS * 60 * 60 * 1000;
  const fresh = matched.filter((l) => l.createdAt.getTime() >= freshEdge);
  const backlog = matched.filter((l) => l.createdAt.getTime() < freshEdge);

  // Пока очередь не пуста, часть лимита за ней закреплена. Без этой брони
  // всплеск свежих объявлений занял бы все слоты, и хвост не сдвинулся бы вообще.
  const reserved = backlog.length > 0 ? Math.max(1, Math.floor(limit * 0.2)) : 0;

  const batch = fresh.slice(0, limit - reserved);
  const left = limit - batch.length;
  // backlog отсортирован по убыванию даты, поэтому хвост массива — самые старые.
  if (left > 0) batch.push(...backlog.slice(-left));

  // Отправляем от старых к новым, чтобы самое свежее пришло последним (внизу чата).
  return batch.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

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
  layout: string | null;
  repairs: string | null;
  wc: string | null;
  furnished: boolean | null;
}

/**
 * OLX и наш UI называют одни и те же значения по-разному: «Совмещённый» против
 * «Совмещенный», «Черновая» против «Черновая отделка». Приводим обе стороны к
 * одному виду, чтобы сравнивать по смыслу, а не побуквенно.
 */
function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

// Вариант из UI -> как то же самое называется в OLX.
const LABEL_ALIASES: Record<string, string> = {
  '2+': '2 санузла и более',
  черновая: 'черновая отделка',
  предчистовая: 'предчистовая отделка',
};

function canonical(value: string): string {
  const normalized = normalizeLabel(value);
  return LABEL_ALIASES[normalized] ?? normalized;
}

/**
 * Сравнивает выбранные в фильтре варианты со значением объявления.
 * У части объявлений параметр не заполнен — такие не отсеиваем, как и в
 * проверках площади и этажа ниже: лучше показать лишнее, чем молча потерять.
 */
function matchesLabel(selected: string[] | undefined, listingValue: string | null): boolean {
  if (!selected || selected.length === 0) return true;
  if (!listingValue) return true;

  const target = canonical(listingValue);
  return selected.some((option) => canonical(option) === target);
}

function matchesFurniture(selected: string[] | undefined, listingValue: boolean | null): boolean {
  if (!selected || selected.length === 0) return true;

  // «Все» означает «без разницы» — если выбран только он, фильтр не ограничивает.
  const wanted = selected.map(canonical).filter((option) => option !== 'все');
  if (wanted.length === 0) return true;
  if (listingValue === null) return true;

  return wanted.some((option) => (option === 'да') === listingValue);
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value.filter(
    (item): item is string => typeof item === 'string' && item !== '' && item !== 'undefined',
  );
  return items.length > 0 ? items : undefined;
}

export function parseCriteria(criteria: unknown): FilterCriteria {
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
    planning: parseStringArray(data.planning),
    renovation: parseStringArray(data.renovation),
    bathroom: parseStringArray(data.bathroom),
    furniture: parseStringArray(data.furniture),
  };
}

export function matchesFilter(
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

  // Дополнительные параметры
  if (!matchesLabel(criteria.planning, listing.layout))
    return {
      match: false,
      reason: `планировка: фильтр=[${criteria.planning}] объявление=${listing.layout}`,
    };
  if (!matchesLabel(criteria.renovation, listing.repairs))
    return {
      match: false,
      reason: `ремонт: фильтр=[${criteria.renovation}] объявление=${listing.repairs}`,
    };
  if (!matchesLabel(criteria.bathroom, listing.wc))
    return {
      match: false,
      reason: `санузел: фильтр=[${criteria.bathroom}] объявление=${listing.wc}`,
    };
  if (!matchesFurniture(criteria.furniture, listing.furnished))
    return {
      match: false,
      reason: `мебель: фильтр=[${criteria.furniture}] объявление=${listing.furnished}`,
    };

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
      console.log(
        `   планировка=[${criteria.planning ?? ''}] ремонт=[${criteria.renovation ?? ''}] санузел=[${criteria.bathroom ?? ''}] мебель=[${criteria.furniture ?? ''}]`,
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

      // Берём всех кандидатов, а не первые N. Критерии фильтра проверяются
      // в памяти, поэтому обрезать выборку до проверки нельзя: подходящее
      // объявление просто не дойдёт до matchesFilter. Ограничение стоит
      // дальше — на количестве отправок, а не на количестве проверок.
      const candidates = await prisma.listing.findMany({
        where: {
          type: filter.type,
          NOT: { id: { in: excludeIds } },
          ...districtFilter,
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log(
        `   кандидатов=${candidates.length} (с районом "${criteria.district}"), уже отправлено=${alreadySentIds.size}`,
      );

      const rejectReasons: Record<string, number> = {};

      // Сначала полный отбор, потом отправка.
      const matched: typeof candidates = [];
      for (const listing of candidates) {
        if (alreadySentIds.has(listing.id)) continue;

        const result = matchesFilter(listing, criteria);
        if (result.match) {
          matched.push(listing);
        } else {
          const key = (result.reason || 'неизвестно').split(':')[0];
          rejectReasons[key] = (rejectReasons[key] || 0) + 1;
        }
      }

      // Свежие уходят сразу, остаток лимита разгребает хвост очереди.
      // Неотправленные не теряются: они не помечены и вернутся в следующий цикл.
      const batch = pickBatch(matched);

      const filterMatchCount = matched.length;
      console.log(
        `   совпало=${filterMatchCount}, отправляем в этом цикле=${batch.length}, ждут очереди=${matched.length - batch.length}`,
      );

      for (const listing of batch) {
        try {
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
            console.warn(
              `  ⏭️ Отправка не удалась — повторим в следующем цикле (listing #${listing.id})`,
            );
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
        } catch (err) {
          console.error(`  ❌ Ошибка листинг #${listing.id}:`, err);
        }
      }

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
