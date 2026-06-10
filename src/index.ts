import { Bot } from 'grammy';
import { config } from './config';
import { ensureDb } from './db/storage';
import { startScheduler, runJob } from './scheduler/cron';

async function main() {
  ensureDb();
  console.log('DB tayyor.');

  const bot = new Bot(config.BOT_TOKEN);

  bot.command('start', (ctx) =>
    ctx.reply('✅ AI News Bot ishlayapti!\n\n/run — hozir yangilik qidirish\n/status — bot holati')
  );

  bot.command('run', async (ctx) => {
    await ctx.reply('🔍 Yangiliklar qidirilmoqda...');
    try {
      await runJob(bot);
      await ctx.reply('✅ Yangiliklar kanal ga joylandi!');
    } catch (err) {
      console.error(err);
      await ctx.reply('❌ Xato yuz berdi. Loglarni tekshiring.');
    }
  });

  bot.command('status', (ctx) =>
    ctx.reply(
      `📊 Bot holati:\n` +
      `• Jadval: ${config.CRON_SCHEDULE}\n` +
      `• Kanal: ${config.CHANNEL_ID}\n` +
      `• Vaqt zonasi: Asia/Tashkent`
    )
  );

  bot.catch((err) => {
    console.error('Bot xatosi:', err);
  });

  startScheduler(bot);

  console.log('Bot ishga tushdi. Ctrl+C bilan to\'xtatish mumkin.');
  await bot.start();
}

main().catch((err) => {
  console.error('Yuklashda xato:', err);
  process.exit(1);
});
