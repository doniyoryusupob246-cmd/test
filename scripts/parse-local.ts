/**
 * Парсер OLX для запуска с локальной машины.
 *
 * Зачем: OLX стоит за CloudFront, и его WAF блокирует запросы с облачных IP
 * (Vercel, Railway и т.п.) с ответом "Request blocked". С обычного домашнего
 * адреса запросы проходят, поэтому парсер живёт здесь, а не на сервере.
 *
 * Пишет в ту же базу Neon, что и прод. Матчер и отправка остаются на Vercel.
 *
 * Запуск:  npx tsx scripts/parse-local.ts
 */
import 'dotenv/config';
import { runParser } from '../lib/parser/olx-parser';
import { prisma } from '../lib/prisma';

async function main() {
  const startedAt = Date.now();
  console.log(`\n=== Парсинг с локальной машины: ${new Date().toISOString()} ===`);

  const before = await prisma.listing.count();
  console.log(`в базе до запуска: ${before}`);

  const res = await runParser();

  const after = await prisma.listing.count();
  const rent = await prisma.listing.count({ where: { type: 'rent' } });
  const sale = await prisma.listing.count({ where: { type: 'sale' } });

  console.log(`\n=== Итог за ${((Date.now() - startedAt) / 1000).toFixed(1)} с ===`);
  console.log(`создано=${res.created} обновлено=${res.updated} удалено=${res.deleted}`);
  console.log(`в базе: ${after} (было ${before}) — аренда ${rent}, продажа ${sale}`);

  if (rent === 0) {
    console.warn('\n⚠️ Аренды в базе нет — фильтры по аренде ничего не найдут.');
  }
}

main()
  .catch((e) => {
    console.error('\n!!! Парсер упал:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
