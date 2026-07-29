import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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
  value?: {
    key?: string | number;
    label?: string;
    value?: string | number;
    currency?: string;
    converted_value?: string | number;
    converted_currency?: string;
  };
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
  last_refresh_time?: string;
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
  layout: string | null;
  repairs: string | null;
  wc: string | null;
  furnished: boolean | null;
  type: string;
  lastSeenAt: Date;
  createdAt: Date;
  priceHistory: PriceHistoryEntry[];
}

interface PriceHistoryEntry extends Prisma.InputJsonObject {
  price: number;
  date: string;
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
  const value = priceParam?.value;

  if (value?.currency === 'UYE' || value?.currency === 'USD') {
    const parsed = Number(value.value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { label, numeric: Math.round(parsed) };
    }
  }

  if (value?.converted_currency === 'UYE' || value?.converted_currency === 'USD') {
    const parsed = Number(value.converted_value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { label, numeric: Math.round(parsed) };
    }
  }

  const rawKey = value?.key ?? value?.value;
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
  // OLX отдаёт мебель как yes/no; у части объявлений параметра нет вовсе.
  const furnishedRaw = getParam(item, 'furnished');

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
    // OLX отдаёт ссылку с плейсхолдером {width}x{height} — подставляем
    // реальные размеры, иначе Telegram не сможет скачать фото.
    image: item.photos?.[0]?.link
      ? item.photos[0].link!.replace('{width}x{height}', '1000x700')
      : null,
    rooms: getParam(item, 'number_of_rooms') ? Number(getParam(item, 'number_of_rooms')) : null,
    area: Number.isFinite(area) && area! > 0 ? area : null,
    floor: getParam(item, 'floor') ? Number(getParam(item, 'floor')) : null,
    totalFloors: getParam(item, 'total_floors') ? Number(getParam(item, 'total_floors')) : null,
    layout: getParamLabel(item, 'layout'),
    repairs: getParamLabel(item, 'repairs'),
    wc: getParamLabel(item, 'wc'),
    furnished: furnishedRaw === 'yes' ? true : furnishedRaw === 'no' ? false : null,
    type,
    lastSeenAt: item.last_refresh_time ? new Date(item.last_refresh_time) : new Date(),
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

/** Сколько страниц OLX тянем одновременно. Последовательно 13 страниц с паузами
 *  занимали больше половины бюджета крона (30 с у cron-job.org). */
const PAGE_CONCURRENCY = 5;

async function parseCategory(type: 'rent' | 'sale', maxItems = 500): Promise<ParsedListing[]> {
  const categoryId = CATEGORIES[type];
  const limit = 40;
  const offsets = Array.from({ length: Math.ceil(maxItems / limit) }, (_, i) => i * limit);
  const all: ParsedListing[] = [];

  console.log(`📡 [Parser] Парсим: ${type} (category_id=${categoryId})`);

  for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
    const batch = offsets.slice(i, i + PAGE_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((o) => fetchPage(categoryId, o, limit)));

    let gotAnything = false;
    for (const [idx, res] of results.entries()) {
      if (res.status === 'rejected') {
        console.error(`❌ [Parser] Ошибка (offset=${batch[idx]}):`, res.reason);
        continue;
      }
      if (!res.value.length) continue;
      gotAnything = true;
      all.push(
        ...res.value
          .map((item) => mapItem(item, type))
          .filter((item): item is ParsedListing => item !== null),
      );
    }

    console.log(`📦 [Parser] Загружено ${all.length} (${type})`);

    // Вся пачка пустая — дальше объявлений нет, дочитывать бессмысленно.
    if (!gotAnything) break;
    if (i + PAGE_CONCURRENCY < offsets.length) await new Promise((r) => setTimeout(r, 200));
  }

  return all.slice(0, maxItems);
}

/** Сколько записей обновляем параллельно. По одной за раз тысяча объявлений
 *  давала тысячи последовательных обращений к базе и выедала весь бюджет крона. */
const WRITE_CONCURRENCY = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function saveListings(
  listings: ParsedListing[],
): Promise<{ created: number; updated: number; newIds: number[] }> {
  // OLX отдаёт одно и то же объявление на разных страницах (промо-блоки),
  // поэтому сначала схлопываем — иначе createMany подавится дублями.
  const unique = [...new Map(listings.map((l) => [l.olxId, l])).values()];
  if (unique.length === 0) return { created: 0, updated: 0, newIds: [] };

  // Один запрос вместо findUnique на каждое объявление.
  const existing = await prisma.listing.findMany({
    where: { olxId: { in: unique.map((l) => l.olxId) } },
    select: { olxId: true, priceNumeric: true, priceHistory: true },
  });
  const known = new Map(existing.map((e) => [e.olxId, e]));

  const toCreate = unique.filter((l) => !known.has(l.olxId));
  const toUpdate = unique.filter((l) => known.has(l.olxId));

  let created = 0;
  let newIds: number[] = [];
  if (toCreate.length > 0) {
    const res = await prisma.listing.createMany({
      data: toCreate.map((l) => ({ ...l, isMatched: false })),
      skipDuplicates: true,
    });
    created = res.count;

    // createMany не возвращает id — добираем отдельным запросом.
    const saved = await prisma.listing.findMany({
      where: { olxId: { in: toCreate.map((l) => l.olxId) } },
      select: { id: true },
    });
    newIds = saved.map((s) => s.id);
  }

  let updated = 0;
  for (const batch of chunk(toUpdate, WRITE_CONCURRENCY)) {
    const results = await Promise.allSettled(
      batch.map((listing) => {
        const prev = known.get(listing.olxId)!;
        const priceHistory = (prev.priceHistory as unknown as PriceHistoryEntry[]) || [];
        // Историю пополняем только когда цена реально сдвинулась.
        if (prev.priceNumeric !== listing.priceNumeric) {
          priceHistory.push({ price: prev.priceNumeric, date: new Date().toISOString() });
        }
        return prisma.listing.update({
          where: { olxId: listing.olxId },
          data: { ...listing, priceHistory, isMatched: false },
        });
      }),
    );

    for (const [i, res] of results.entries()) {
      if (res.status === 'fulfilled') updated++;
      else console.error(`❌ Ошибка сохранения olxId=${batch[i].olxId}:`, res.reason);
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
