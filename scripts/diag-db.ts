// Временная диагностика подключения к Neon напрямую через pg, без Prisma.
import 'dotenv/config';
import { Client } from 'pg';

const BASE = process.env.DATABASE_URL || '';

// Пробуем варианты строки: node-postgres не поддерживает SCRAM channel binding,
// и параметр channel_binding=require может рвать соединение.
const variants: [string, string][] = [
  ['как в .env', BASE],
  ['без channel_binding', BASE.replace(/[?&]channel_binding=require/, (m) => (m[0] === '?' ? '?' : ''))],
  ['прямой endpoint (без -pooler)', BASE.replace('-pooler', '')],
];

async function tryOne(name: string, url: string) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const r = await client.query('select current_user, version()');
    console.log(`✅ ${name}: подключились (${String(r.rows[0].version).slice(0, 40)}...)`);
    return client;
  } catch (e) {
    console.log(`❌ ${name}: ${(e as Error).message}`);
    await client.end().catch(() => {});
    return null;
  }
}

async function main() {
  let live = null;
  for (const [name, url] of variants) {
    if (!url) continue;
    live = await tryOne(name, url);
    if (live) break;
  }
  if (!live) {
    console.log('\nНи один вариант не подключился.');
    return;
  }

  console.log('\n--- состояние базы ---');
  const q = async (sql: string) => (await live!.query(sql)).rows;

  console.log('только чтение?', (await q('show transaction_read_only'))[0]);
  console.log('размер базы   ', (await q(`select pg_size_pretty(pg_database_size(current_database())) as size`))[0]);

  const counts = await q(`
    select 'Listing' t, count(*) n from "Listing"
    union all select 'Notification', count(*) from "Notification"
    union all select 'Filter', count(*) from "Filter"
    union all select 'User', count(*) from "User"`);
  console.log('строки        ', counts);

  console.log('свежесть      ', (await q(`select max("updatedAt") as last_update, max("lastSeenAt") as last_seen from "Listing"`))[0]);
  console.log('колонки Listing', (await q(`select column_name from information_schema.columns where table_name='Listing' and column_name in ('layout','repairs','wc','furnished')`)).map((r) => r.column_name));

  console.log('\n--- пробная запись ---');
  try {
    await live.query(`create temp table _probe(x int)`);
    console.log('✅ временную таблицу создать смогли — база не read-only');
  } catch (e) {
    console.log('❌ запись запрещена:', (e as Error).message);
  }

  await live.end();
}

main().catch((e) => {
  console.error('УПАЛО:', e);
  process.exit(1);
});
