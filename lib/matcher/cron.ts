// ⚠️ УСТАРЕЛО: node-cron не работает в Next.js serverless окружении.
// Используй внешний cron сервис (cron-job.org, Railway Cron, Render Cron)
// который будет вызывать POST /api/cron каждые 15 минут.
//
// Инструкция: см. README или docs/CRON_SETUP.md

// Для локальной разработки можно раскомментировать:
// import cron from 'node-cron';
// import { runMatching } from './matcher';
// cron.schedule('*/15 * * * *', async () => {
//   console.log('🕐 Cron job запущен:', new Date().toISOString());
//   await runMatching();
// });
