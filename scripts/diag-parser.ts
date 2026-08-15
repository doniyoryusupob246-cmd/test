// Временная диагностика: прогоняет настоящий парсер по одной странице
// и показывает, доехало ли сохранение до базы. Чистка отключена.
import 'dotenv/config';
import { runParser } from '../lib/parser/olx-parser';
import { prisma } from '../lib/prisma';

async function main() {
  const before = await prisma.listing.count();
  console.log(`\n=== в базе до запуска: ${before} ===\n`);

  const res = await runParser({ maxPerCategory: 40, categories: ['rent'], cleanupDays: 99999 });

  const after = await prisma.listing.count();
  console.log(`\n=== результат ===`);
  console.log(`   вернул runParser:`, res);
  console.log(`   в базе стало:      ${after}  (было ${before}, дельта ${after - before})`);

  const sample = await prisma.listing.findMany({
    where: { type: 'rent' },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: { olxId: true, priceNumeric: true, repairs: true, furnished: true, updatedAt: true },
  });
  console.log(`\n   три последних обновлённых:`);
  for (const s of sample) console.log(`   `, s);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n!!! УПАЛО:', e);
  await prisma.$disconnect();
  process.exit(1);
});
