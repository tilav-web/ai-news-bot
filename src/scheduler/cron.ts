import cron from 'node-cron';
import { Bot } from 'grammy';
import { fetchAllSources, type NewsItem } from '../sources';
import { generateSinglePost } from '../ai/gemini';
import { publishSinglePost } from '../publisher/channel';
import { isPosted, markPosted } from '../db/storage';
import { config } from '../config';

const POST_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 soat

async function postItem(bot: Bot, item: NewsItem): Promise<void> {
  try {
    console.log(`  → Post tayyorlanmoqda: "${item.title}"`);
    const postText = await generateSinglePost(item);
    await publishSinglePost(bot, postText, item);
    markPosted(item.url, item.title);
    console.log(`  ✓ Joylandi: "${item.title}"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Post xatosi: ${msg}`);
  }
}

export async function runJob(bot: Bot): Promise<void> {
  console.log('\n=== Yangilik qidirish boshlandi ===');

  const allItems = await fetchAllSources();
  console.log(`Jami topildi: ${allItems.length} ta`);

  const newItems = allItems.filter((item) => item.url && !isPosted(item.url));
  console.log(`Yangi: ${newItems.length} ta`);

  if (newItems.length === 0) {
    console.log('Bugun yangi yangilik topilmadi.');
    console.log('=====================================\n');
    return;
  }

  // Birinchi post darhol
  const [first, ...rest] = newItems as [NewsItem, ...NewsItem[]];
  await postItem(bot, first);

  // Qolganlarini 3 soat oraliqda
  rest.forEach((item, i) => {
    const delay = (i + 1) * POST_INTERVAL_MS;
    const postAt = new Date(Date.now() + delay).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
    console.log(`  ⏰ "${item.title}" — ${postAt} da joylashadi`);
    setTimeout(() => void postItem(bot, item), delay);
  });

  console.log('=====================================\n');
}

export function startScheduler(bot: Bot): void {
  if (!cron.validate(config.CRON_SCHEDULE)) {
    throw new Error(`Noto'g'ri CRON_SCHEDULE: ${config.CRON_SCHEDULE}`);
  }

  cron.schedule(
    config.CRON_SCHEDULE,
    () => {
      void runJob(bot).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Scheduler xatosi:', msg);
      });
    },
    { timezone: 'Asia/Tashkent' }
  );

  console.log(`Scheduler yoqildi: "${config.CRON_SCHEDULE}" (Asia/Tashkent)`);
}
