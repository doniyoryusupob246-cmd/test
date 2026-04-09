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

function parseCriteria(criteria: any): FilterCriteria {
  if (typeof criteria === 'string') {
    try {
      criteria = JSON.parse(criteria);
    } catch {
      return { type: 'rent' };
    }
  }
  if (!criteria || typeof criteria !== 'object') return { type: 'rent' };

  return {
    type: criteria.type === 'sale' ? 'sale' : 'rent',
    district: criteria.district || undefined,
    priceMin: typeof criteria.priceMin === 'number' ? criteria.priceMin : undefined,
    priceMax: typeof criteria.priceMax === 'number' ? criteria.priceMax : undefined,
    rooms:
      Array.isArray(criteria.rooms) && criteria.rooms.length > 0
        ? criteria.rooms.map(String)
        : undefined,
    areaMin: typeof criteria.areaMin === 'number' ? criteria.areaMin : undefined,
    areaMax: typeof criteria.areaMax === 'number' ? criteria.areaMax : undefined,
    floorMin: typeof criteria.floorMin === 'number' ? criteria.floorMin : undefined,
    floorMax: typeof criteria.floorMax === 'number' ? criteria.floorMax : undefined,
    totalFloorsMainMin:
      typeof criteria.totalFloorsMainMin === 'number' ? criteria.totalFloorsMainMin : undefined,
    totalFloorsMainMax:
      typeof criteria.totalFloorsMainMax === 'number' ? criteria.totalFloorsMainMax : undefined,
    planning:
      Array.isArray(criteria.planning) && criteria.planning.length > 0
        ? criteria.planning.map(String)
        : undefined,
    renovation:
      Array.isArray(criteria.renovation) && criteria.renovation.length > 0
        ? criteria.renovation.map(String)
        : undefined,
    bathroom:
      Array.isArray(criteria.bathroom) && criteria.bathroom.length > 0
        ? criteria.bathroom.map(String)
        : undefined,
    furniture:
      Array.isArray(criteria.furniture) && criteria.furniture.length > 0
        ? criteria.furniture.map(String)
        : undefined,
  };
}

function matchesFilter(listing: any, criteria: FilterCriteria, filterId: number): boolean {
  // 1. Тип — БАГ ИСПРАВЛЕН: filter.type хранится отдельно, не в criteria
  // type проверяется снаружи

  // 2. Район — БАГ ИСПРАВЛЕН: сравниваем без учёта регистра + проверяем rayon тоже
  if (criteria.district) {
    const filterDistrict = criteria.district.toLowerCase().trim();
    const listingDistrict = (listing.district || '').toLowerCase().trim();
    const listingRayon = (listing.rayon || '').toLowerCase().trim();

    const districtMatch =
      listingDistrict.includes(filterDistrict) ||
      filterDistrict.includes(listingDistrict) ||
      listingRayon.includes(filterDistrict) ||
      filterDistrict.includes(listingRayon);

    if (!districtMatch) {
      console.log(
        `    ❌ [${filterId}] Район не совпал: фильтр="${criteria.district}" листинг="${listing.district}/${listing.rayon}"`,
      );
      return false;
    }
  }

  // 3. Цена — БАГ ИСПРАВЛЕН: priceNumeric может быть в разных валютах/форматах
  // Проверяем только если цена > 0 в листинге
  if (listing.priceNumeric > 0) {
    if (criteria.priceMin && listing.priceNumeric < criteria.priceMin) {
      console.log(
        `    ❌ [${filterId}] Цена ниже минимума: ${listing.priceNumeric} < ${criteria.priceMin}`,
      );
      return false;
    }
    if (criteria.priceMax && listing.priceNumeric > criteria.priceMax) {
      console.log(
        `    ❌ [${filterId}] Цена выше максимума: ${listing.priceNumeric} > ${criteria.priceMax}`,
      );
      return false;
    }
  }

  // 4. Комнаты
  if (criteria.rooms && criteria.rooms.length > 0) {
    if (listing.rooms === null || listing.rooms === undefined) {
      // Если комнаты не указаны в объявлении — пропускаем этот фильтр
    } else {
      const roomsMatch = criteria.rooms.some((room) => {
        if (room === '5+') return listing.rooms >= 5;
        return listing.rooms === parseInt(room);
      });
      if (!roomsMatch) {
        console.log(
          `    ❌ [${filterId}] Комнаты не совпали: фильтр=[${criteria.rooms}] листинг=${listing.rooms}`,
        );
        return false;
      }
    }
  }

  // 5. Площадь
  if (criteria.areaMin && listing.area && listing.area < criteria.areaMin) return false;
  if (criteria.areaMax && listing.area && listing.area > criteria.areaMax) return false;

  // 6. Этаж
  if (criteria.floorMin && listing.floor && listing.floor < criteria.floorMin) return false;
  if (criteria.floorMax && listing.floor && listing.floor > criteria.floorMax) return false;

  // 7. Этажность
  if (
    criteria.totalFloorsMainMin &&
    listing.totalFloors &&
    listing.totalFloors < criteria.totalFloorsMainMin
  )
    return false;
  if (
    criteria.totalFloorsMainMax &&
    listing.totalFloors &&
    listing.totalFloors > criteria.totalFloorsMainMax
  )
    return false;

  return true;
}

export async function runMatching() {
  console.log('🔍 [Matcher] Начинаем матчинг...', new Date().toISOString());

  try {
    const newListings = await prisma.listing.findMany({
      where: { isMatched: false },
      take: 100,
    });

    if (newListings.length === 0) {
      console.log('📭 Нет новых объявлений для матчинга');
      return;
    }

    console.log(`📦 Новых объявлений: ${newListings.length}`);

    const filters = await prisma.filter.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`🎯 Активных фильтров: ${filters.length}`);

    // ── ДИАГНОСТИКА: показываем что в фильтрах и листингах ──
    for (const f of filters) {
      const c = parseCriteria(f.criteria);
      console.log(
        `  📋 Фильтр #${f.id} "${f.name}": type=${f.type} district=${c.district} price=${c.priceMin}-${c.priceMax} rooms=${c.rooms}`,
      );
    }
    if (newListings.length > 0) {
      const sample = newListings[0];
      console.log(
        `  📄 Пример объявления: type=${sample.type} district="${sample.district}" rayon="${sample.rayon}" price=${sample.priceNumeric} rooms=${sample.rooms}`,
      );
    }
    // ─────────────────────────────────────────────────────────

    let matchedCount = 0;

    for (const listing of newListings) {
      for (const filter of filters) {
        try {
          // БАГ ИСПРАВЛЕН: type берём из filter.type, не из criteria
          const listingType = listing.type || 'rent';
          if (filter.type !== listingType) {
            continue; // тихо пропускаем — не логируем каждый
          }

          const alreadySent = await prisma.notification.findFirst({
            where: { userId: filter.userId, listingId: listing.id },
          });
          if (alreadySent) continue;

          const criteria = parseCriteria(filter.criteria);

          if (matchesFilter(listing, criteria, filter.id)) {
            console.log(
              `✅ СОВПАДЕНИЕ! Фильтр #${filter.id} "${filter.name}" → "${listing.title}"`,
            );

            await sendNotification(
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
          console.error(`❌ Ошибка фильтр #${filter.id}:`, err);
        }
      }

      await prisma.listing.update({
        where: { id: listing.id },
        data: { isMatched: true },
      });
    }

    console.log(`🎉 Матчинг завершён! Уведомлений отправлено: ${matchedCount}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Критическая ошибка матчинга:', msg);
  }
}
