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
//     try {
//       criteria = JSON.parse(criteria);
//     } catch {
//       return { type: 'rent' };
//     }
//   }
//   if (!criteria || typeof criteria !== 'object') return { type: 'rent' };

//   return {
//     type: criteria.type === 'sale' ? 'sale' : 'rent',
//     district: criteria.district || undefined,
//     priceMin: typeof criteria.priceMin === 'number' ? criteria.priceMin : undefined,
//     priceMax: typeof criteria.priceMax === 'number' ? criteria.priceMax : undefined,
//     rooms:
//       Array.isArray(criteria.rooms) && criteria.rooms.length > 0
//         ? criteria.rooms.map(String)
//         : undefined,
//     areaMin: typeof criteria.areaMin === 'number' ? criteria.areaMin : undefined,
//     areaMax: typeof criteria.areaMax === 'number' ? criteria.areaMax : undefined,
//     floorMin: typeof criteria.floorMin === 'number' ? criteria.floorMin : undefined,
//     floorMax: typeof criteria.floorMax === 'number' ? criteria.floorMax : undefined,
//     totalFloorsMainMin:
//       typeof criteria.totalFloorsMainMin === 'number' ? criteria.totalFloorsMainMin : undefined,
//     totalFloorsMainMax:
//       typeof criteria.totalFloorsMainMax === 'number' ? criteria.totalFloorsMainMax : undefined,
//     planning:
//       Array.isArray(criteria.planning) && criteria.planning.length > 0
//         ? criteria.planning.map(String)
//         : undefined,
//     renovation:
//       Array.isArray(criteria.renovation) && criteria.renovation.length > 0
//         ? criteria.renovation.map(String)
//         : undefined,
//     bathroom:
//       Array.isArray(criteria.bathroom) && criteria.bathroom.length > 0
//         ? criteria.bathroom.map(String)
//         : undefined,
//     furniture:
//       Array.isArray(criteria.furniture) && criteria.furniture.length > 0
//         ? criteria.furniture.map(String)
//         : undefined,
//   };
// }

// function matchesFilter(listing: any, criteria: FilterCriteria): boolean {
//   // Район
//   if (criteria.district) {
//     const filterDistrict = criteria.district.toLowerCase().trim();
//     const listingDistrict = (listing.district || '').toLowerCase().trim();
//     const listingRayon = (listing.rayon || '').toLowerCase().trim();

//     if (!listingDistrict && !listingRayon) return false;

//     const districtMatch =
//       listingDistrict.includes(filterDistrict) ||
//       filterDistrict.includes(listingDistrict) ||
//       listingRayon.includes(filterDistrict) ||
//       filterDistrict.includes(listingRayon);

//     if (!districtMatch) return false;
//   }

//   // Цена
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
//   if (
//     criteria.totalFloorsMainMin &&
//     listing.totalFloors &&
//     listing.totalFloors < criteria.totalFloorsMainMin
//   )
//     return false;
//   if (
//     criteria.totalFloorsMainMax &&
//     listing.totalFloors &&
//     listing.totalFloors > criteria.totalFloorsMainMax
//   )
//     return false;

//   return true;
// }

// export async function runMatching() {
//   console.log('🔍 [Matcher] Начинаем матчинг...', new Date().toISOString());

//   try {
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
//       const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//       // Загружаем уже отправленные ID — фильтруем null и гарантируем number[]
//       const alreadySentNotifications = await prisma.notification.findMany({
//         where: { userId: filter.userId },
//         select: { listingId: true },
//       });

//       // ✅ ФИКС: фильтруем null, приводим к number[]
//       const alreadySentIds = new Set<number>(
//         alreadySentNotifications.map((n) => n.listingId).filter((id): id is number => id !== null),
//       );

//       const excludeIds: number[] = alreadySentIds.size > 0 ? Array.from(alreadySentIds) : [-1]; // -1 чтобы NOT IN не был пустым

//       const candidates = await prisma.listing.findMany({
//         where: {
//           type: filter.type,
//           createdAt: { gte: sevenDaysAgo },
//           NOT: {
//             id: { in: excludeIds }, // ✅ теперь number[] без null
//           },
//         },
//         orderBy: { createdAt: 'desc' },
//         take: 200,
//       });

//       console.log(`  📋 Фильтр #${filter.id} "${filter.name}": кандидатов=${candidates.length}`);

//       for (const listing of candidates) {
//         if (alreadySentIds.has(listing.id)) continue;

//         try {
//           if (matchesFilter(listing, criteria)) {
//             console.log(
//               `  ✅ СОВПАДЕНИЕ! Фильтр #${filter.id} → "${listing.title}" $${listing.priceNumeric}`,
//             );

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

//             await prisma.notification.create({
//               data: {
//                 userId: filter.userId,
//                 filterId: filter.id,
//                 listingId: listing.id,
//               },
//             });

//             alreadySentIds.add(listing.id);
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

      // ✅ ГЛАВНЫЙ ФИКС: фильтруем по району прямо в Prisma
      const districtFilter = criteria.district
        ? {
            OR: [
              { district: { contains: criteria.district, mode: 'insensitive' as const } },
              { rayon: { contains: criteria.district, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const candidates = await prisma.listing.findMany({
        where: {
          type: filter.type,
          NOT: { id: { in: excludeIds } },
          ...districtFilter, // ← район фильтруется в БД
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

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

            alreadySentIds.add(listing.id);
            matchedCount++;
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
