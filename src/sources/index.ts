import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { config } from '../config';

export interface NewsItem {
  title: string;
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  source: string;
  summary?: string;
}

const rssParser = new Parser({ timeout: 10000 });
const httpClient = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; NewsBot/1.0)',
  },
});

function isRecent(date: Date | undefined): boolean {
  if (!date || isNaN(date.getTime())) return false;
  const cutoff = Date.now() - config.HOURS_BACK * 60 * 60 * 1000;
  return date.getTime() > cutoff;
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const { data } = await httpClient.get(url);
    const $ = cheerio.load(data);
    return (
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content')
    );
  } catch {
    return undefined;
  }
}

// ──────────────────────────────────────────────
// Anthropic
// ──────────────────────────────────────────────
async function fetchAnthropic(): Promise<NewsItem[]> {
  try {
    const feed = await rssParser.parseURL('https://www.anthropic.com/rss.xml');
    const items: NewsItem[] = [];
    for (const entry of feed.items.slice(0, config.MAX_ITEMS_PER_SOURCE)) {
      const date = entry.pubDate ? new Date(entry.pubDate) : undefined;
      if (!isRecent(date)) continue;
      const url = entry.link || '';
      items.push({
        title: entry.title || 'Anthropic yangiligi',
        url,
        publishedAt: date!,
        source: 'Anthropic',
        ...(entry.contentSnippet && { summary: entry.contentSnippet.slice(0, 300) }),
      });
    }
    return items;
  } catch {
    return fetchAnthropicHtml();
  }
}

async function fetchAnthropicHtml(): Promise<NewsItem[]> {
  try {
    const { data } = await httpClient.get('https://www.anthropic.com/news');
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];
    $('a[href*="/news/"]').each((_, el) => {
      if (items.length >= config.MAX_ITEMS_PER_SOURCE) return false;
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim();
      if (!title || !href || href === '/news') return;
      const url = href.startsWith('http') ? href : `https://www.anthropic.com${href}`;
      const timeEl = $(el).closest('article').find('time');
      const dateStr = timeEl.attr('datetime') || timeEl.text();
      const date = dateStr ? new Date(dateStr) : new Date();
      if (!isRecent(date)) return;
      items.push({ title, url, publishedAt: date, source: 'Anthropic' });
    });
    return items;
  } catch (err) {
    console.error('Anthropic scrape xatosi:', err);
    return [];
  }
}

// ──────────────────────────────────────────────
// OpenAI (RSS)
// ──────────────────────────────────────────────
async function fetchOpenAI(): Promise<NewsItem[]> {
  const rssUrls = [
    'https://openai.com/news/rss.xml',
    'https://openai.com/blog/rss.xml',
  ];
  for (const feedUrl of rssUrls) {
    try {
      const feed = await rssParser.parseURL(feedUrl);
      const items: NewsItem[] = [];
      for (const entry of feed.items.slice(0, config.MAX_ITEMS_PER_SOURCE)) {
        const date = entry.pubDate ? new Date(entry.pubDate) : undefined;
        if (!isRecent(date)) continue;
        items.push({
          title: entry.title || 'OpenAI yangiligi',
          url: entry.link || '',
          publishedAt: date!,
          source: 'OpenAI',
          ...(entry.contentSnippet && { summary: entry.contentSnippet.slice(0, 300) }),
        });
      }
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  console.warn('  OpenAI RSS topilmadi, o\'tkazib yuborildi.');
  return [];
}

// ──────────────────────────────────────────────
// Google DeepMind / AI Blog (RSS)
// ──────────────────────────────────────────────
async function fetchGoogle(): Promise<NewsItem[]> {
  const feeds = [
    'https://blog.google/technology/ai/rss/',
    'https://blog.google/technology/google-deepmind/rss/',
  ];
  const items: NewsItem[] = [];

  for (const feedUrl of feeds) {
    try {
      const feed = await rssParser.parseURL(feedUrl);
      for (const entry of feed.items.slice(0, config.MAX_ITEMS_PER_SOURCE)) {
        if (items.length >= config.MAX_ITEMS_PER_SOURCE) break;
        const date = entry.pubDate ? new Date(entry.pubDate) : undefined;
        if (!isRecent(date)) continue;
        items.push({
          title: entry.title || 'Google AI yangiligi',
          url: entry.link || '',
          publishedAt: date!,
          source: 'Google AI',
          ...(entry.contentSnippet && { summary: entry.contentSnippet.slice(0, 300) }),
        });
      }
      if (items.length > 0) break;
    } catch {
      continue;
    }
  }
  return items;
}

// ──────────────────────────────────────────────
// Gemini Blog
// ──────────────────────────────────────────────
async function fetchGemini(): Promise<NewsItem[]> {
  try {
    const { data } = await httpClient.get('https://blog.google/products/gemini/');
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];

    $('article a[href], h3 a[href]').each((_, el) => {
      if (items.length >= config.MAX_ITEMS_PER_SOURCE) return false;
      const href = $(el).attr('href') || '';
      const title =
        $(el).find('h2, h3').first().text().trim() || $(el).text().trim();
      if (!title || title.length < 5 || !href) return;
      const url = href.startsWith('http') ? href : `https://blog.google${href}`;

      const timeEl = $(el).closest('article, li').find('time').first();
      const dateStr = timeEl.attr('datetime') || timeEl.text();
      const date = dateStr ? new Date(dateStr) : new Date();
      if (!isRecent(date)) return;

      items.push({ title, url, publishedAt: date, source: 'Gemini Blog' });
    });
    return items;
  } catch (err) {
    console.error('Gemini Blog scrape xatosi:', err);
    return [];
  }
}

// ──────────────────────────────────────────────
// GitHub Copilot / VS Code updates
// ──────────────────────────────────────────────
async function fetchGitHubBlog(): Promise<NewsItem[]> {
  try {
    const feed = await rssParser.parseURL('https://github.blog/feed/');
    const items: NewsItem[] = [];
    const keywords = ['copilot', 'ai', 'model', 'codex', 'agent'];

    for (const entry of feed.items) {
      if (items.length >= config.MAX_ITEMS_PER_SOURCE) break;
      const date = entry.pubDate ? new Date(entry.pubDate) : undefined;
      if (!isRecent(date)) continue;
      const title = (entry.title || '').toLowerCase();
      if (!keywords.some((kw) => title.includes(kw))) continue;
      items.push({
        title: entry.title || 'GitHub Blog',
        url: entry.link || '',
        publishedAt: date!,
        source: 'GitHub Blog',
        ...(entry.contentSnippet && { summary: entry.contentSnippet.slice(0, 300) }),
      });
    }
    return items;
  } catch (err) {
    console.error('GitHub Blog xatosi:', err);
    return [];
  }
}

// ──────────────────────────────────────────────
// Antigravity
// ──────────────────────────────────────────────
async function fetchAntigravity(): Promise<NewsItem[]> {
  const urls = [
    'https://antigravity.dev/changelog',
    'https://antigravity.dev/blog',
  ];
  for (const pageUrl of urls) {
    try {
      const { data } = await httpClient.get(pageUrl);
      const $ = cheerio.load(data);
      const items: NewsItem[] = [];

      $('a[href]').each((_, el) => {
        if (items.length >= config.MAX_ITEMS_PER_SOURCE) return false;
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim();
        if (!title || title.length < 5 || !href) return;
        const url = href.startsWith('http') ? href : `https://antigravity.dev${href}`;

        const timeEl = $(el).closest('article, section, li').find('time').first();
        const dateStr = timeEl.attr('datetime') || timeEl.text();
        const date = dateStr ? new Date(dateStr) : new Date();
        if (!isRecent(date)) return;

        items.push({ title, url, publishedAt: date, source: 'Antigravity' });
      });

      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  return [];
}

// ──────────────────────────────────────────────
// Aggregate: barcha manbalardan to'plash
// ──────────────────────────────────────────────
export async function fetchAllSources(): Promise<NewsItem[]> {
  console.log('Manbalardan yangiliklar qidirilmoqda...');

  const results = await Promise.allSettled([
    fetchAnthropic(),
    fetchOpenAI(),
    fetchGoogle(),
    fetchGemini(),
    fetchGitHubBlog(),
    fetchAntigravity(),
  ]);

  const all: NewsItem[] = [];
  const names = ['Anthropic', 'OpenAI', 'Google', 'Gemini', 'GitHub', 'Antigravity'];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`  ✓ ${names[i]}: ${result.value.length} ta yangilik`);
      all.push(...result.value);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`  ✗ ${names[i]}: ${msg.slice(0, 80)}`);
    }
  });

  // Attach OG images asynchronously (parallel, max 5)
  const withImages = all.filter((item) => !item.imageUrl).slice(0, 5);
  await Promise.allSettled(
    withImages.map(async (item) => {
      const img = await fetchOgImage(item.url);
      if (img) item.imageUrl = img;
    })
  );

  return all.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
