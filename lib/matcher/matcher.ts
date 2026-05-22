// import { prisma } from '@/lib/prisma';
// import { sendNotification } from './notification';

// interface FilterCriteria {
//   type: 'rent' | 'sale';
//   district?: string;
//   priceMin?: number;
//   priceMax?: number;
//   rooms?: string[];
//   areaMin?: number;
//   areaMax?: number;
//   floorMin?: number;
//   floorMax?: number;
//   totalFloorsMainMin?: number;
//   totalFloorsMainMax?: number;
//   planning?: string[];
//   renovation?: string[];
//   bathroom?: string[];
//   furniture?: string[];
// }

// function parseCriteria(criteria: any): FilterCriteria {
//   if (typeof criteria === 'string') {
//     try { criteria = JSON.parse(criteria); }
//     catch { return { type: 'rent' }; }
//   }
//   if (!criteria || typeof criteria !== 'object') return { type: 'rent' };

//   return {
//     type: criteria.type === 'sale' ? 'sale' : 'rent',
//     district: criteria.district || undefined,
//     priceMin: typeof criteria.priceMin === 'number' ? criteria.priceMin : undefined,
//     priceMax: typeof criteria.priceMax === 'number' ? criteria.priceMax : undefined,
//     rooms: Array.isArray(criteria.rooms) && criteria.rooms.length > 0 ? criteria.rooms.map(String) : undefined,
//     areaMin: typeof criteria.areaMin === 'number' ? criteria.areaMin : undefined,
//     areaMax: typeof criteria.areaMax === 'number' ? criteria.areaMax : undefined,
//     floorMin: typeof criteria.floorMin === 'number' ? criteria.floorMin : undefined,
//     floorMax: typeof criteria.floorMax === 'number' ? criteria.floorMax : undefined,
//     totalFloorsMainMin: typeof criteria.totalFloorsMainMin === 'number' ? criteria.totalFloorsMainMin : undefined,
//     totalFloorsMainMax: typeof criteria.totalFloorsMainMax === 'number' ? criteria.totalFloorsMainMax : undefined,
//     planning: Array.isArray(criteria.planning) && criteria.planning.length > 0 ? criteria.planning.map(String) : undefined,
//     renovation: Array.isArray(criteria.renovation) && criteria.renovation.length > 0 ? criteria.renovation.map(String) : undefined,
//     bathroom: Array.isArray(criteria.bathroom) && criteria.bathroom.length > 0 ? criteria.bathroom.map(String) : undefined,
//     furniture: Array.isArray(criteria.furniture) && criteria.furniture.length > 0 ? criteria.furniture.map(String) : undefined,
//   };
// }

// function matchesFilter(listing: any, criteria: FilterCriteria, filterId: number): boolean {
//   // Район
//   if (criteria.district) {
//     const filterDistrict = criteria.district.toLowerCase().trim();
//     const listingDistrict = (listing.district || '').toLowerCase().trim();
//     const listingRayon = (listing.rayon || '').toLowerCase().trim();
//     const districtMatch =
//       listingDistrict.includes(filterDistrict) ||
//       filterDistrict.includes(listingDistrict) ||
//       listingRayon.includes(filterDistrict) ||
//       filterDistrict.includes(listingRayon);
//     if (!districtMatch) return false;
//   }

//   // Цена (только если в объявлении есть цена)
//   if (listing.priceNumeric > 0) {
//     if (criteria.priceMin && listing.priceNumeric < criteria.priceMin) return false;
//     if (criteria.priceMax && listing.priceNumeric > criteria.priceMax) return false;
//   }

//   // Комнаты
//   if (criteria.rooms && criteria.rooms.length > 0 && listing.rooms != null) {
//     const roomsMatch = criteria.rooms.some((room) => {
//       if (room === '5+') return listing.rooms >= 5;
//       return listing.rooms === parseInt(room);
//     });
//     if (!roomsMatch) return false;
//   }

//   // Площадь
//   if (criteria.areaMin && listing.area && listing.area < criteria.areaMin) return false;
//   if (criteria.areaMax && listing.area && listing.area > criteria.areaMax) return false;

//   // Этаж
//   if (criteria.floorMin && listing.floor && listing.floor < criteria.floorMin) return false;
//   if (criteria.floorMax && listing.floor && listing.floor > criteria.floorMax) return false;

//   // Этажность
//   if (criteria.totalFloorsMainMin && listing.totalFloors && listing.totalFloors < criteria.totalFloorsMainMin) return false;
//   if (criteria.totalFloorsMainMax && listing.totalFloors && listing.totalFloors > criteria.totalFloorsMainMax) return false;

//   return true;
// }

// export async function runMatching() {
//   console.log('🔍 [Matcher] Начинаем матчинг...', new Date().toISOString());

//   try {
//     // ─── Берём ВСЕ активные фильтры ────────────────────────────────────
//     const filters = await prisma.filter.findMany({
//       where: { isActive: true },
//       include: { user: true },
//     });

//     if (filters.length === 0) {
//       console.log('📭 Нет активных фильтров');
//       return;
//     }

//     console.log(`🎯 Активных фильтров: ${filters.length}`);

//     let matchedCount = 0;

//     for (const filter of filters) {
//       const criteria = parseCriteria(filter.criteria);

//       // ─── Для каждого фильтра ищем объявления которые:
//       // 1. Подходят по типу (rent/sale)
//       // 2. Ещё НЕ были отправлены этому пользователю
//       // 3. Появились не старше 7 дней (чтобы не спамить старьём)
//       const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//       const candidates = await prisma.listing.findMany({
//         where: {
//           type: filter.type,
//           createdAt: { gte: sevenDaysAgo },
//           // Исключаем уже отправленные этому пользователю
//           notifications: {
//             none: {
//               userId: filter.userId,
//               filterId: filter.id,
//             },
//           },
//         },
//         orderBy: { createdAt: 'desc' },
//         take: 200, // берём последние 200 на каждый фильтр
//       });

//       console.log(`  📋 Фильтр #${filter.id} "${filter.name}": кандидатов=${candidates.length}`);

//       for (const listing of candidates) {
//         try {
//           if (matchesFilter(listing, criteria, filter.id)) {
//             console.log(`  ✅ СОВПАДЕНИЕ! Фильтр #${filter.id} → "${listing.title}" $${listing.priceNumeric}`);

//             await sendNotification(
//               {
//                 id: filter.user.id,
//                 chatId: filter.user.chatId,
//                 firstName: filter.user.firstName,
//                 lastName: filter.user.lastName,
//                 username: filter.user.username,
//                 telegramId: filter.user.telegramId,
//               },
//               listing,
//               filter,
//             );

//             // Записываем что отправили — чтобы не дублировать
//             await prisma.notification.create({
//               data: {
//                 userId: filter.userId,
//                 filterId: filter.id,
//                 listingId: listing.id,
//               },
//             });

//             matchedCount++;
//           }
//         } catch (err) {
//           console.error(`  ❌ Ошибка листинг #${listing.id}:`, err);
//         }
//       }
//     }

//     console.log(`🎉 Матчинг завершён! Уведомлений: ${matchedCount}`);
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : String(error);
//     console.error('❌ Критическая ошибка матчинга:', msg);
//   }
// }

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

function matchesFilter(listing: any, criteria: FilterCriteria): boolean {
  // ─── ФИКС #1: Район ───────────────────────────────────────────────────────
  // Если пользователь указал район — объявление БЕЗ района не подходит
  if (criteria.district) {
    const filterDistrict = criteria.district.toLowerCase().trim();
    const listingDistrict = (listing.district || '').toLowerCase().trim();
    const listingRayon = (listing.rayon || '').toLowerCase().trim();

    // Если в объявлении вообще нет района — пропускаем
    if (!listingDistrict && !listingRayon) {
      console.log(`    ⛔ Район не указан в объявлении — пропускаем`);
      return false;
    }

    const districtMatch =
      listingDistrict.includes(filterDistrict) ||
      filterDistrict.includes(listingDistrict) ||
      listingRayon.includes(filterDistrict) ||
      filterDistrict.includes(listingRayon);

    if (!districtMatch) {
      return false;
    }
  }

  // ─── Цена ─────────────────────────────────────────────────────────────────
  if (listing.priceNumeric > 0) {
    if (criteria.priceMin && listing.priceNumeric < criteria.priceMin) return false;
    if (criteria.priceMax && listing.priceNumeric > criteria.priceMax) return false;
  }

  // ─── Комнаты ──────────────────────────────────────────────────────────────
  if (criteria.rooms && criteria.rooms.length > 0 && listing.rooms != null) {
    const roomsMatch = criteria.rooms.some((room) => {
      if (room === '5+') return listing.rooms >= 5;
      return listing.rooms === parseInt(room);
    });
    if (!roomsMatch) return false;
  }

  // ─── Площадь ──────────────────────────────────────────────────────────────
  if (criteria.areaMin && listing.area && listing.area < criteria.areaMin) return false;
  if (criteria.areaMax && listing.area && listing.area > criteria.areaMax) return false;

  // ─── Этаж ─────────────────────────────────────────────────────────────────
  if (criteria.floorMin && listing.floor && listing.floor < criteria.floorMin) return false;
  if (criteria.floorMax && listing.floor && listing.floor > criteria.floorMax) return false;

  // ─── Этажность дома ───────────────────────────────────────────────────────
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // ─── ФИКС #2: Дубликаты ─────────────────────────────────────────────
      // Берём ID объявлений которые УЖЕ отправляли этому пользователю
      const alreadySentNotifications = await prisma.notification.findMany({
        where: { userId: filter.userId },
        select: { listingId: true },
      });
      const alreadySentIds = new Set(alreadySentNotifications.map((n) => n.listingId));
      // ────────────────────────────────────────────────────────────────────

      const candidates = await prisma.listing.findMany({
        where: {
          type: filter.type,
          createdAt: { gte: sevenDaysAgo },
          // Исключаем уже отправленные — через NOT IN
          NOT: {
            id: { in: alreadySentIds.size > 0 ? Array.from(alreadySentIds) : [-1] },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      console.log(`  📋 Фильтр #${filter.id} "${filter.name}": кандидатов=${candidates.length}`);

      for (const listing of candidates) {
        // Двойная проверка на дубликат (на случай race condition)
        if (alreadySentIds.has(listing.id)) continue;

        try {
          if (matchesFilter(listing, criteria)) {
            console.log(
              `  ✅ СОВПАДЕНИЕ! Фильтр #${filter.id} → "${listing.title}" $${listing.priceNumeric}`,
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

            // Записываем СРАЗУ после отправки — предотвращает дубликаты
            await prisma.notification.create({
              data: {
                userId: filter.userId,
                filterId: filter.id,
                listingId: listing.id,
              },
            });

            // Добавляем в локальный Set чтобы не отправить дважды в этом же запуске
            alreadySentIds.add(listing.id);

            matchedCount++;
          }
        } catch (err) {
          console.error(`  ❌ Ошибка листинг #${listing.id}:`, err);
        }
      }
    }

    console.log(`🎉 Матчинг завершён! Уведомлений: ${matchedCount}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Критическая ошибка матчинга:', msg);
  }
}
