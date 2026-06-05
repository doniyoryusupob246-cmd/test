

// import { prisma } from '@/lib/prisma';

// const OLX_API = 'https://olx.uz/api/v1/offers/';

// const CATEGORIES = {
//   rent: 1511,
//   sale: 1510,
// };

// // ─── Типы ──────────────────────────────────────────────────────────────────

// interface OlxParam {
//   key: string;
//   value?: {
//     key?: string | number;
//     label?: string;
//   };
// }

// interface OlxItem {
//   id: number;
//   title: string;
//   url: string;
//   description?: string;
//   business?: boolean; // ✅ ДОБАВЛЕНО
//   params?: OlxParam[];
//   location?: {
//     city?: { name?: string };
//     region?: { name?: string };
//     district?: { name?: string };
//   };
//   map?: { lat?: number; lon?: number };
//   photos?: { link?: string }[];
//   created_time?: string;
// }

// interface ParsedListing {
//   olxId: string;
//   title: string;
//   url: string;
//   price: string;
//   priceNumeric: number;
//   description: string;
//   city: string | null;
//   region: string | null;
//   district: string | null;
//   rayon: string | null;
//   lat: number | null;
//   lon: number | null;
//   image: string | null;
//   rooms: number | null;
//   area: number | null;
//   floor: number | null;
//   totalFloors: number | null;
//   type: string;
//   lastSeenAt: Date;
//   createdAt: Date;
//   priceHistory: any[];
// }

// // ─── Хелперы ───────────────────────────────────────────────────────────────

// function getParam(item: OlxItem, key: string): string | null {
//   const param = item.params?.find((p) => p.key === key);
//   return param?.value?.key != null ? String(param.value.key) : null;
// }

// function getParamLabel(item: OlxItem, key: string): string | null {
//   const param = item.params?.find((p) => p.key === key);
//   return param?.value?.label || null;
// }

// // Курс сума к доллару — обновляй раз в месяц
// const UZS_TO_USD_RATE = Number(process.env.UZS_TO_USD_RATE) || 12800;

// function extractPrice(item: OlxItem): { label: string; numeric: number } {
//   const priceParam = item.params?.find((p) => p.key === 'price');
//   const label = priceParam?.value?.label || 'Договорная';

//   const rawKey = priceParam?.value?.key;
//   let priceInSums = 0;

//   if (rawKey !== null && rawKey !== undefined) {
//     const parsed = parseFloat(String(rawKey).replace(/[^0-9.]/g, ''));
//     if (Number.isFinite(parsed) && parsed > 0) {
//       priceInSums = parsed;
//     }
//   }

//   if (priceInSums === 0 && label && label !== 'Договорная') {
//     const fromLabel = parseFloat(label.replace(/[^0-9.]/g, ''));
//     if (Number.isFinite(fromLabel) && fromLabel > 0) {
//       priceInSums = fromLabel;
//     }
//   }

//   const priceInUsd = priceInSums > 0 ? Math.round(priceInSums / UZS_TO_USD_RATE) : 0;

//   return { label, numeric: priceInUsd };
// }

// // ─── Маппинг одного объявления ─────────────────────────────────────────────

// function mapItem(item: OlxItem, type: 'rent' | 'sale'): ParsedListing | null {
//   // ✅ ФИЛЬТР #1: только частные объявления (не агентства/бизнес)
//   if (item.business === true) {
//     return null;
//   }

//   // ✅ ФИЛЬТР #2: без комиссионных
//   const commissionParam = item.params?.find((p) => p.key === 'comission');
//   if (commissionParam?.value?.key === 'yes') {
//     return null;
//   }

//   const { label: priceLabel, numeric: priceNumeric } = extractPrice(item);

//   const locationDistrict = item.location?.district?.name || null;
//   const rayonLabel = getParamLabel(item, 'district');

//   const areaRaw = getParam(item, 'total_area');
//   const area = areaRaw ? parseFloat(areaRaw) : null;

//   return {
//     olxId: String(item.id),
//     title: item.title,
//     url: item.url,
//     price: priceLabel,
//     priceNumeric,
//     description: item.description?.replace(/<br ?\/?>/gi, '\n') || '',
//     city: item.location?.city?.name || null,
//     region: item.location?.region?.name || null,
//     district: locationDistrict,
//     rayon: rayonLabel || locationDistrict,
//     lat: item.map?.lat || null,
//     lon: item.map?.lon || null,
//     image: item.photos?.[0]?.link || null,
//     rooms: getParam(item, 'number_of_rooms') ? Number(getParam(item, 'number_of_rooms')) : null,
//     area: Number.isFinite(area) && area! > 0 ? area : null,
//     floor: getParam(item, 'floor') ? Number(getParam(item, 'floor')) : null,
//     totalFloors: getParam(item, 'total_floors') ? Number(getParam(item, 'total_floors')) : null,
//     type,
//     lastSeenAt: new Date(),
//     createdAt: item.created_time ? new Date(item.created_time) : new Date(),
//     priceHistory: [],
//   };
// }

// // ─── Один запрос к OLX API ────────────────────────────────────────────────

// async function fetchPage(categoryId: number, offset: number, limit: number): Promise<OlxItem[]> {
//   const url = `${OLX_API}?offset=${offset}&limit=${limit}&category_id=${categoryId}`;

//   const response = await fetch(url, {
//     headers: {
//       'User-Agent':
//         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
//       Accept: 'application/json',
//     },
//     signal: AbortSignal.timeout(20000),
//   });

//   if (!response.ok) {
//     throw new Error(`OLX API вернул ${response.status}: ${response.statusText}`);
//   }

//   const data = await response.json();
//   return data?.data || [];
// }

// // ─── Парсинг одной категории ──────────────────────────────────────────────

// async function parseCategory(type: 'rent' | 'sale', maxItems = 500): Promise<ParsedListing[]> {
//   const categoryId = CATEGORIES[type];
//   const limit = 40;
//   let offset = 0;
//   const all: ParsedListing[] = [];

//   console.log(`📡 [Parser] Парсим категорию: ${type} (category_id=${categoryId})`);

//   while (all.length < maxItems) {
//     try {
//       const items = await fetchPage(categoryId, offset, limit);

//       if (!items.length) {
//         console.log(`📭 [Parser] Больше нет объявлений (offset=${offset})`);
//         break;
//       }

//       // ✅ фильтруем null (агентства и с комиссией)
//       const mapped = items
//         .map((item) => mapItem(item, type))
//         .filter((item): item is ParsedListing => item !== null);

//       all.push(...mapped);
//       offset += limit;

//       console.log(`📦 [Parser] Загружено ${all.length} объявлений (${type})`);

//       await new Promise((r) => setTimeout(r, 300));
//     } catch (err) {
//       console.error(`❌ [Parser] Ошибка при загрузке страницы (offset=${offset}):`, err);
//       break;
//     }
//   }

//   return all.slice(0, maxItems);
// }

// // ─── Сохранение в БД (upsert) ─────────────────────────────────────────────

// async function saveListings(listings: ParsedListing[]): Promise<{
//   created: number;
//   updated: number;
//   newIds: number[];
// }> {
//   let created = 0;
//   let updated = 0;
//   const newIds: number[] = [];

//   for (const listing of listings) {
//     try {
//       const existing = await prisma.listing.findUnique({
//         where: { olxId: listing.olxId },
//         select: { id: true, priceNumeric: true, priceHistory: true },
//       });

//       if (existing) {
//         const priceHistory = (existing.priceHistory as any[]) || [];

//         if (existing.priceNumeric !== listing.priceNumeric) {
//           priceHistory.push({
//             price: existing.priceNumeric,
//             date: new Date().toISOString(),
//           });
//         }

//         await prisma.listing.update({
//           where: { olxId: listing.olxId },
//           data: {
//             ...listing,
//             priceHistory,
//             isMatched: false,
//           },
//         });
//         updated++;
//       } else {
//         const saved = await prisma.listing.create({
//           data: {
//             ...listing,
//             isMatched: false,
//           },
//         });
//         newIds.push(saved.id);
//         created++;
//       }
//     } catch (err) {
//       console.error(`❌ [Parser] Ошибка сохранения olxId=${listing.olxId}:`, err);
//     }
//   }

//   return { created, updated, newIds };
// }

// // ─── Очистка старых объявлений ────────────────────────────────────────────

// async function cleanupOldListings(days = 7): Promise<number> {
//   const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

//   const result = await prisma.listing.deleteMany({
//     where: {
//       lastSeenAt: { lt: cutoff },
//     },
//   });

//   return result.count;
// }

// // ─── Главная функция ──────────────────────────────────────────────────────

// export async function runParser(options?: {
//   maxPerCategory?: number;
//   categories?: ('rent' | 'sale')[];
//   cleanupDays?: number;
// }) {
//   const { maxPerCategory = 500, categories = ['rent', 'sale'], cleanupDays = 7 } = options || {};

//   console.log('🚀 [Parser] Запуск парсера OLX...', new Date().toISOString());

//   let totalCreated = 0;
//   let totalUpdated = 0;
//   const allNewIds: number[] = [];

//   for (const type of categories) {
//     try {
//       const listings = await parseCategory(type, maxPerCategory);

//       if (!listings.length) {
//         console.log(`⚠️ [Parser] Нет объявлений для категории: ${type}`);
//         continue;
//       }

//       const { created, updated, newIds } = await saveListings(listings);
//       totalCreated += created;
//       totalUpdated += updated;
//       allNewIds.push(...newIds);

//       console.log(`✅ [Parser] ${type}: создано=${created} обновлено=${updated}`);
//     } catch (err) {
//       console.error(`❌ [Parser] Ошибка категории ${type}:`, err);
//     }
//   }

//   const deleted = await cleanupOldListings(cleanupDays);
//   if (deleted > 0) {
//     console.log(`🧹 [Parser] Удалено старых объявлений (>${cleanupDays} дней): ${deleted}`);
//   }

//   console.log(
//     `🎉 [Parser] Готово! Создано: ${totalCreated}, Обновлено: ${totalUpdated}, Удалено: ${deleted}`,
//   );

//   return {
//     created: totalCreated,
//     updated: totalUpdated,
//     deleted,
//     newListingIds: allNewIds,
//   };
// }



// import { prisma } from '@/lib/prisma';

// const OLX_API = 'https://olx.uz/api/v1/offers/';

// // ✅ Правильные категории OLX
// const CATEGORIES = {
//   rent: 1147,  // Аренда квартир
//   sale: 13,    // Продажа квартир
// };

// const REGION_ID = 5; // Ташкентская область
// const CITY_ID = 4;   // Ташкент

// interface OlxParam {
//   key: string;
//   value?: { key?: string | number; label?: string };
// }

// interface OlxItem {
//   id: number;
//   title: string;
//   url: string;
//   description?: string;
//   business?: boolean;
//   params?: OlxParam[];
//   location?: {
//     city?: { name?: string };
//     region?: { name?: string };
//     district?: { name?: string };
//   };
//   map?: { lat?: number; lon?: number };
//   photos?: { link?: string }[];
//   created_time?: string;
// }

// interface ParsedListing {
//   olxId: string;
//   title: string;
//   url: string;
//   price: string;
//   priceNumeric: number;
//   description: string;
//   city: string | null;
//   region: string | null;
//   district: string | null;
//   rayon: string | null;
//   lat: number | null;
//   lon: number | null;
//   image: string | null;
//   rooms: number | null;
//   area: number | null;
//   floor: number | null;
//   totalFloors: number | null;
//   type: string;
//   lastSeenAt: Date;
//   createdAt: Date;
//   priceHistory: any[];
// }

// function getParam(item: OlxItem, key: string): string | null {
//   const param = item.params?.find((p) => p.key === key);
//   return param?.value?.key != null ? String(param.value.key) : null;
// }

// function getParamLabel(item: OlxItem, key: string): string | null {
//   const param = item.params?.find((p) => p.key === key);
//   return param?.value?.label || null;
// }

// const UZS_TO_USD_RATE = Number(process.env.UZS_TO_USD_RATE) || 12800;

// function extractPrice(item: OlxItem): { label: string; numeric: number } {
//   const priceParam = item.params?.find((p) => p.key === 'price');
//   const label = priceParam?.value?.label || 'Договорная';
//   const rawKey = priceParam?.value?.key;
//   let priceInSums = 0;

//   if (rawKey !== null && rawKey !== undefined) {
//     const parsed = parseFloat(String(rawKey).replace(/[^0-9.]/g, ''));
//     if (Number.isFinite(parsed) && parsed > 0) priceInSums = parsed;
//   }

//   if (priceInSums === 0 && label && label !== 'Договорная') {
//     const fromLabel = parseFloat(label.replace(/[^0-9.]/g, ''));
//     if (Number.isFinite(fromLabel) && fromLabel > 0) priceInSums = fromLabel;
//   }

//   return { label, numeric: priceInSums > 0 ? Math.round(priceInSums / UZS_TO_USD_RATE) : 0 };
// }

// function mapItem(item: OlxItem, type: 'rent' | 'sale'): ParsedListing | null {
//   if (item.business === true) return null;

//   const commissionParam = item.params?.find((p) => p.key === 'comission');
//   if (commissionParam?.value?.key === 'yes') return null;

//   const { label: priceLabel, numeric: priceNumeric } = extractPrice(item);
//   const locationDistrict = item.location?.district?.name || null;
//   const rayonLabel = getParamLabel(item, 'district');
//   const areaRaw = getParam(item, 'total_area');
//   const area = areaRaw ? parseFloat(areaRaw) : null;

//   return {
//     olxId: String(item.id),
//     title: item.title,
//     url: item.url,
//     price: priceLabel,
//     priceNumeric,
//     description: item.description?.replace(/<br ?\/?>/gi, '\n') || '',
//     city: item.location?.city?.name || null,
//     region: item.location?.region?.name || null,
//     district: locationDistrict,
//     rayon: rayonLabel || locationDistrict,
//     lat: item.map?.lat || null,
//     lon: item.map?.lon || null,
//     image: item.photos?.[0]?.link || null,
//     rooms: getParam(item, 'number_of_rooms') ? Number(getParam(item, 'number_of_rooms')) : null,
//     area: Number.isFinite(area) && area! > 0 ? area : null,
//     floor: getParam(item, 'floor') ? Number(getParam(item, 'floor')) : null,
//     totalFloors: getParam(item, 'total_floors') ? Number(getParam(item, 'total_floors')) : null,
//     type,
//     lastSeenAt: new Date(),
//     createdAt: item.created_time ? new Date(item.created_time) : new Date(),
//     priceHistory: [],
//   };
// }

// async function fetchPage(categoryId: number, offset: number, limit: number): Promise<OlxItem[]> {
//   // ✅ Добавили region_id и city_id — только Ташкент
//   const url = `${OLX_API}?offset=${offset}&limit=${limit}&category_id=${categoryId}&region_id=${REGION_ID}&city_id=${CITY_ID}&currency=UZS&suggest_filters=true`;

//   const response = await fetch(url, {
//     headers: {
//       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
//       Accept: 'application/json',
//     },
//     signal: AbortSignal.timeout(20000),
//   });

//   if (!response.ok) throw new Error(`OLX API вернул ${response.status}: ${response.statusText}`);

//   const data = await response.json();
//   return data?.data || [];
// }

// async function parseCategory(type: 'rent' | 'sale', maxItems = 500): Promise<ParsedListing[]> {
//   const categoryId = CATEGORIES[type];
//   const limit = 40;
//   let offset = 0;
//   const all: ParsedListing[] = [];

//   console.log(`📡 [Parser] Парсим: ${type} (category_id=${categoryId})`);

//   while (all.length < maxItems) {
//     try {
//       const items = await fetchPage(categoryId, offset, limit);
//       if (!items.length) { console.log(`📭 Нет объявлений (offset=${offset})`); break; }

//       const mapped = items
//         .map((item) => mapItem(item, type))
//         .filter((item): item is ParsedListing => item !== null);

//       all.push(...mapped);
//       offset += limit;
//       console.log(`📦 [Parser] Загружено ${all.length} (${type})`);
//       await new Promise((r) => setTimeout(r, 300));
//     } catch (err) {
//       console.error(`❌ [Parser] Ошибка (offset=${offset}):`, err);
//       break;
//     }
//   }

//   return all.slice(0, maxItems);
// }

// async function saveListings(listings: ParsedListing[]): Promise<{ created: number; updated: number; newIds: number[] }> {
//   let created = 0, updated = 0;
//   const newIds: number[] = [];

//   for (const listing of listings) {
//     try {
//       const existing = await prisma.listing.findUnique({
//         where: { olxId: listing.olxId },
//         select: { id: true, priceNumeric: true, priceHistory: true },
//       });

//       if (existing) {
//         const priceHistory = (existing.priceHistory as any[]) || [];
//         if (existing.priceNumeric !== listing.priceNumeric) {
//           priceHistory.push({ price: existing.priceNumeric, date: new Date().toISOString() });
//         }
//         await prisma.listing.update({
//           where: { olxId: listing.olxId },
//           data: { ...listing, priceHistory, isMatched: false },
//         });
//         updated++;
//       } else {
//         const saved = await prisma.listing.create({ data: { ...listing, isMatched: false } });
//         newIds.push(saved.id);
//         created++;
//       }
//     } catch (err) {
//       console.error(`❌ Ошибка сохранения olxId=${listing.olxId}:`, err);
//     }
//   }

//   return { created, updated, newIds };
// }

// async function cleanupOldListings(days = 7): Promise<number> {
//   const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
//   const result = await prisma.listing.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
//   return result.count;
// }

// export async function runParser(options?: {
//   maxPerCategory?: number;
//   categories?: ('rent' | 'sale')[];
//   cleanupDays?: number;
// }) {
//   const { maxPerCategory = 500, categories = ['rent', 'sale'], cleanupDays = 7 } = options || {};
//   console.log('🚀 [Parser] Запуск...', new Date().toISOString());

//   let totalCreated = 0, totalUpdated = 0;
//   const allNewIds: number[] = [];

//   for (const type of categories) {
//     try {
//       const listings = await parseCategory(type, maxPerCategory);
//       if (!listings.length) { console.log(`⚠️ Нет объявлений: ${type}`); continue; }

//       const { created, updated, newIds } = await saveListings(listings);
//       totalCreated += created;
//       totalUpdated += updated;
//       allNewIds.push(...newIds);
//       console.log(`✅ [Parser] ${type}: создано=${created} обновлено=${updated}`);
//     } catch (err) {
//       console.error(`❌ Ошибка категории ${type}:`, err);
//     }
//   }

//   const deleted = await cleanupOldListings(cleanupDays);
//   if (deleted > 0) console.log(`🧹 Удалено старых (>${cleanupDays} дней): ${deleted}`);
//   console.log(`🎉 Готово! Создано: ${totalCreated}, Обновлено: ${totalUpdated}, Удалено: ${deleted}`);

//   return { created: totalCreated, updated: totalUpdated, deleted, newListingIds: allNewIds };
// }


import { prisma } from '@/lib/prisma';

const OLX_API = 'https://olx.uz/api/v1/offers/';

// ✅ Правильные категории OLX
const CATEGORIES = {
  rent: 1147,  // Аренда квартир
  sale: 13,    // Продажа квартир
};

const REGION_ID = 5; // Ташкентская область
const CITY_ID = 4;   // Ташкент

interface OlxParam {
  key: string;
  value?: { key?: string | number; label?: string };
}

interface OlxItem {
  id: number;
  title: string;
  url: string;
  description?: string;
  business?: boolean;
  params?: OlxParam[];
  location?: {
    city?: { name?: string };
    region?: { name?: string };
    district?: { name?: string };
  };
  map?: { lat?: number; lon?: number };
  photos?: { link?: string }[];
  created_time?: string;
}

interface ParsedListing {
  olxId: string;
  title: string;
  url: string;
  price: string;
  priceNumeric: number;
  description: string;
  city: string | null;
  region: string | null;
  district: string | null;
  rayon: string | null;
  lat: number | null;
  lon: number | null;
  image: string | null;
  rooms: number | null;
  area: number | null;
  floor: number | null;
  totalFloors: number | null;
  type: string;
  lastSeenAt: Date;
  createdAt: Date;
  priceHistory: any[];
}

function getParam(item: OlxItem, key: string): string | null {
  const param = item.params?.find((p) => p.key === key);
  return param?.value?.key != null ? String(param.value.key) : null;
}

function getParamLabel(item: OlxItem, key: string): string | null {
  const param = item.params?.find((p) => p.key === key);
  return param?.value?.label || null;
}

const UZS_TO_USD_RATE = Number(process.env.UZS_TO_USD_RATE) || 12800;

function extractPrice(item: OlxItem): { label: string; numeric: number } {
  const priceParam = item.params?.find((p) => p.key === 'price');
  const label = priceParam?.value?.label || 'Договорная';
  const rawKey = priceParam?.value?.key;
  let priceInSums = 0;

  if (rawKey !== null && rawKey !== undefined) {
    const parsed = parseFloat(String(rawKey).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) priceInSums = parsed;
  }

  if (priceInSums === 0 && label && label !== 'Договорная') {
    const fromLabel = parseFloat(label.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(fromLabel) && fromLabel > 0) priceInSums = fromLabel;
  }

  return { label, numeric: priceInSums > 0 ? Math.round(priceInSums / UZS_TO_USD_RATE) : 0 };
}

function mapItem(item: OlxItem, type: 'rent' | 'sale'): ParsedListing | null {
  // Без комиссии — на случай если OLX всё равно вернёт
  const commissionParam = item.params?.find((p) => p.key === 'comission');
  if (commissionParam?.value?.key === 'yes') return null;

  const { label: priceLabel, numeric: priceNumeric } = extractPrice(item);
  const locationDistrict = item.location?.district?.name || null;
  const rayonLabel = getParamLabel(item, 'district');
  const areaRaw = getParam(item, 'total_area');
  const area = areaRaw ? parseFloat(areaRaw) : null;

  return {
    olxId: String(item.id),
    title: item.title,
    url: item.url,
    price: priceLabel,
    priceNumeric,
    description: item.description?.replace(/<br ?\/?>/gi, '\n') || '',
    city: item.location?.city?.name || null,
    region: item.location?.region?.name || null,
    district: locationDistrict,
    rayon: rayonLabel || locationDistrict,
    lat: item.map?.lat || null,
    lon: item.map?.lon || null,
    image: item.photos?.[0]?.link || null,
    rooms: getParam(item, 'number_of_rooms') ? Number(getParam(item, 'number_of_rooms')) : null,
    area: Number.isFinite(area) && area! > 0 ? area : null,
    floor: getParam(item, 'floor') ? Number(getParam(item, 'floor')) : null,
    totalFloors: getParam(item, 'total_floors') ? Number(getParam(item, 'total_floors')) : null,
    type,
    lastSeenAt: new Date(),
    createdAt: item.created_time ? new Date(item.created_time) : new Date(),
    priceHistory: [],
  };
}

async function fetchPage(categoryId: number, offset: number, limit: number): Promise<OlxItem[]> {
  // ✅ owner_type=private — только частные объявления прямо в запросе
  const url = `${OLX_API}?offset=${offset}&limit=${limit}&category_id=${categoryId}&region_id=${REGION_ID}&city_id=${CITY_ID}&owner_type=private&currency=UZS&suggest_filters=true`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`OLX API вернул ${response.status}: ${response.statusText}`);

  const data = await response.json();
  return data?.data || [];
}

async function parseCategory(type: 'rent' | 'sale', maxItems = 500): Promise<ParsedListing[]> {
  const categoryId = CATEGORIES[type];
  const limit = 40;
  let offset = 0;
  const all: ParsedListing[] = [];

  console.log(`📡 [Parser] Парсим: ${type} (category_id=${categoryId})`);

  while (all.length < maxItems) {
    try {
      const items = await fetchPage(categoryId, offset, limit);
      if (!items.length) { console.log(`📭 Нет объявлений (offset=${offset})`); break; }

      const mapped = items
        .map((item) => mapItem(item, type))
        .filter((item): item is ParsedListing => item !== null);

      all.push(...mapped);
      offset += limit;
      console.log(`📦 [Parser] Загружено ${all.length} (${type})`);
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`❌ [Parser] Ошибка (offset=${offset}):`, err);
      break;
    }
  }

  return all.slice(0, maxItems);
}

async function saveListings(listings: ParsedListing[]): Promise<{ created: number; updated: number; newIds: number[] }> {
  let created = 0, updated = 0;
  const newIds: number[] = [];

  for (const listing of listings) {
    try {
      const existing = await prisma.listing.findUnique({
        where: { olxId: listing.olxId },
        select: { id: true, priceNumeric: true, priceHistory: true },
      });

      if (existing) {
        const priceHistory = (existing.priceHistory as any[]) || [];
        if (existing.priceNumeric !== listing.priceNumeric) {
          priceHistory.push({ price: existing.priceNumeric, date: new Date().toISOString() });
        }
        await prisma.listing.update({
          where: { olxId: listing.olxId },
          data: { ...listing, priceHistory, isMatched: false },
        });
        updated++;
      } else {
        const saved = await prisma.listing.create({ data: { ...listing, isMatched: false } });
        newIds.push(saved.id);
        created++;
      }
    } catch (err) {
      console.error(`❌ Ошибка сохранения olxId=${listing.olxId}:`, err);
    }
  }

  return { created, updated, newIds };
}

async function cleanupOldListings(days = 7): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.listing.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
  return result.count;
}

export async function runParser(options?: {
  maxPerCategory?: number;
  categories?: ('rent' | 'sale')[];
  cleanupDays?: number;
}) {
  const { maxPerCategory = 500, categories = ['rent', 'sale'], cleanupDays = 7 } = options || {};
  console.log('🚀 [Parser] Запуск...', new Date().toISOString());

  let totalCreated = 0, totalUpdated = 0;
  const allNewIds: number[] = [];

  for (const type of categories) {
    try {
      const listings = await parseCategory(type, maxPerCategory);
      if (!listings.length) { console.log(`⚠️ Нет объявлений: ${type}`); continue; }

      const { created, updated, newIds } = await saveListings(listings);
      totalCreated += created;
      totalUpdated += updated;
      allNewIds.push(...newIds);
      console.log(`✅ [Parser] ${type}: создано=${created} обновлено=${updated}`);
    } catch (err) {
      console.error(`❌ Ошибка категории ${type}:`, err);
    }
  }

  const deleted = await cleanupOldListings(cleanupDays);
  if (deleted > 0) console.log(`🧹 Удалено старых (>${cleanupDays} дней): ${deleted}`);
  console.log(`🎉 Готово! Создано: ${totalCreated}, Обновлено: ${totalUpdated}, Удалено: ${deleted}`);

  return { created: totalCreated, updated: totalUpdated, deleted, newListingIds: allNewIds };
}