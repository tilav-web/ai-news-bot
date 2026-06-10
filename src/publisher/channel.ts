import { Bot } from 'grammy';
import { config } from '../config';
import type { NewsItem } from '../sources';

export async function publishSinglePost(
  bot: Bot,
  postText: string,
  item: NewsItem
): Promise<void> {
  const linkLine = `\n\n🔗 ${item.source}: ${item.url}`;
  const fullText = postText + linkLine;

  if (item.imageUrl) {
    try {
      const MAX_CAPTION = 1024;
      const caption =
        fullText.length <= MAX_CAPTION
          ? fullText
          : postText.slice(0, MAX_CAPTION - linkLine.length - 3) + '...' + linkLine;

      await bot.api.sendPhoto(config.CHANNEL_ID, item.imageUrl, {
        caption,
        parse_mode: 'HTML',
      });
      return;
    } catch {
      // fallback to text
    }
  }

  await bot.api.sendMessage(config.CHANNEL_ID, fullText, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}
