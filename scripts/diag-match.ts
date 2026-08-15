// Временная диагностика: берём живые объявления OLX, раскладываем их так же,
// как это делает парсер, и прогоняем через настоящий matchesFilter с теми
// фильтрами, что видны в логах прода.
import 'dotenv/config';
import { matchesFilter, parseCriteria } from '../lib/matcher/matcher';

const UZS_TO_USD_RATE = Number(process.env.UZS_TO_USD_RATE) || 12800;

type P = { key: string; value?: Record<string, unknown> };
type Item = { id: number; params?: P[]; location?: { district?: { name?: string } }; created_time?: string };

const label = (it: Item, k: string) => (it.params?.find((p) => p.key === k)?.value?.label as string) ?? null;
const rawKey = (it: Item, k: string) => {
  const v = it.params?.find((p) => p.key === k)?.value?.key;
  return v == null ? null : String(v);
};

function price(it: Item): number {
  const v = it.params?.find((p) => p.key === 'price')?.value as Record<string, unknown> | undefined;
  if (!v) return 0;
  if (v.currency === 'UYE' || v.currency === 'USD') {
    const n = Number(v.value);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  if (v.converted_currency === 'UYE' || v.converted_currency === 'USD') {
    const n = Number(v.converted_value);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const raw = v.key ?? v.value;
  const n = parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n / UZS_TO_USD_RATE) : 0;
}

async function fetchAll(): Promise<Item[]> {
  // Данные заранее скачаны в файл: в этой песочнице Node не выпускают в сеть.
  const { readFileSync } = await import('fs');
  const path = process.argv[2];
  return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
}

// Фильтры ровно как в логе прода
const FILTERS = [
  { id: 19, district: 'Бектемирский', c: { type: 'rent', priceMin: 200, priceMax: 1000 } },
  { id: 10, district: 'Юнусабадский', c: { type: 'rent', priceMin: 190, priceMax: 600, rooms: ['3'], planning: ['Раздельная'], renovation: ['Средний'], bathroom: ['Раздельный'], furniture: ['Да'] } },
  { id: 15, district: 'Юнусабадский', c: { type: 'rent', priceMin: 300, priceMax: 830, rooms: ['1', '2', '3', '4'] } },
  { id: 16, district: 'Алмазарский', c: { type: 'rent', priceMin: 260, priceMax: 750 } },
  { id: 17, district: 'Юнусабадский', c: { type: 'rent', priceMin: 400, priceMax: 1000 } },
  { id: 18, district: null, c: { type: 'rent', priceMin: 400, priceMax: 1000 } },
];

async function main() {
  const items = await fetchAll();
  console.log(`\nживых объявлений аренды: ${items.length}\n`);

  const listings = items.map((it) => ({
    district: it.location?.district?.name ?? null,
    priceNumeric: price(it),
    rooms: rawKey(it, 'number_of_rooms') ? Number(rawKey(it, 'number_of_rooms')) : null,
    area: rawKey(it, 'total_area') ? parseFloat(rawKey(it, 'total_area')!) : null,
    floor: rawKey(it, 'floor') ? Number(rawKey(it, 'floor')) : null,
    totalFloors: rawKey(it, 'total_floors') ? Number(rawKey(it, 'total_floors')) : null,
    layout: label(it, 'layout'),
    repairs: label(it, 'repairs'),
    wc: label(it, 'wc'),
    furnished: rawKey(it, 'furnished') === 'yes' ? true : rawKey(it, 'furnished') === 'no' ? false : null,
  }));

  for (const f of FILTERS) {
    // district отсеивается в SQL — повторяем ту же логику contains
    const cands = f.district
      ? listings.filter((l) => (l.district ?? '').toLowerCase().includes(f.district.toLowerCase()))
      : listings;

    const criteria = parseCriteria(f.c);
    const reasons: Record<string, number> = {};
    let ok = 0;
    for (const l of cands) {
      const r = matchesFilter(l, criteria);
      if (r.match) ok++;
      else {
        const k = (r.reason || '?').split(':')[0];
        reasons[k] = (reasons[k] || 0) + 1;
      }
    }
    console.log(
      `Фильтр #${f.id} ${String(f.district ?? 'весь Ташкент').padEnd(15)} ` +
        `цена ${f.c.priceMin}-${f.c.priceMax}  кандидатов=${String(cands.length).padStart(3)}  ` +
        `СОВПАЛО=${String(ok).padStart(3)}   ${ok === 0 ? JSON.stringify(reasons) : ''}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
