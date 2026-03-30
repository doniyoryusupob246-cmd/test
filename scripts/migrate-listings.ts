import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

// Правильная инициализация Prisma
const prisma = new PrismaClient();

// ИЗМЕНИ НА СВОЙ URL!
const SOURCE_MONGO_URL = 'mongodb://localhost:27017/olx_bot'; // твой URL

const client = new MongoClient(SOURCE_MONGO_URL);

async function migrate() {
  console.log('🚀 Начинаем миграцию данных...');
  console.log(`📡 Подключение к: ${SOURCE_MONGO_URL}`);

  try {
    // Подключаемся к источнику
    await client.connect();
    console.log('✅ Подключились к базе-источнику');

    const db = client.db();

    // Проверяем какие коллекции есть
    const collections = await db.listCollections().toArray();
    console.log(
      '📁 Доступные коллекции:',
      collections.map((c) => c.name),
    );

    // Определяем имя коллекции
    let collectionName = 'listings';
    if (!collections.some((c) => c.name === 'listings')) {
      const possible = ['apartments', 'properties', 'ads', 'posts'];
      const found = possible.find((p) => collections.some((c) => c.name === p));
      if (found) {
        collectionName = found;
        console.log(`📂 Найдена коллекция: ${collectionName}`);
      } else {
        console.log('❌ Не найдена коллекция с объявлениями');
        return;
      }
    }

    const sourceListings = await db.collection(collectionName).find().toArray();
    console.log(`📦 Найдено ${sourceListings.length} объявлений`);

    let migrated = 0;
    let skipped = 0;

    for (const listing of sourceListings) {
      try {
        // Преобразуем данные
        const data = {
          olxId: String(listing.olxId || listing._id),
          title: listing.title || 'Без названия',
          url: listing.url || '',
          price: String(listing.price || '0'),
          priceNumeric: Number(listing.priceNumeric || listing.price || 0),
          description: listing.description || '',
          rayon: listing.rayon || null,
          district: listing.district || null,
          city: listing.city || null,
          region: listing.region || null,
          lat: listing.lat ? Number(listing.lat) : null,
          lon: listing.lon ? Number(listing.lon) : null,
          image: listing.image || null,
          rooms: listing.rooms ? Number(listing.rooms) : null,
          area: listing.area ? Number(listing.area) : null,
          floor: listing.floor ? Number(listing.floor) : null,
          totalFloors: listing.totalFloors ? Number(listing.totalFloors) : null,
          type: listing.type || 'rent',
          createdAt: listing.createdAt || listing.createAt || new Date(),
          lastSeenAt: new Date(),
          priceHistory: listing.priceHistory || [],
          isMatched: false,
        };

        // Сохраняем
        await prisma.listing.upsert({
          where: { olxId: data.olxId },
          update: data,
          create: data,
        });

        migrated++;

        if (migrated % 100 === 0) {
          console.log(`📊 Прогресс: ${migrated}/${sourceListings.length}`);
        }
      } catch (err) {
        console.error(`❌ Ошибка для ${listing.olxId}:`, err);
        skipped++;
      }
    }

    console.log(`\n🎉 Миграция завершена!`);
    console.log(`✅ Перенесено: ${migrated}`);
    console.log(`⚠️ Пропущено: ${skipped}`);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

migrate();
