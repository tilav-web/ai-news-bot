import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function ensureDb(): void {
  const dbPath = path.join(__dirname, '../../data/posted.db');
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS posted_urls (
      url TEXT PRIMARY KEY,
      title TEXT,
      posted_at INTEGER NOT NULL
    )
  `);
}

export function isPosted(url: string): boolean {
  if (!db) throw new Error('DB not initialized. Call ensureDb() first.');
  const row = db.prepare('SELECT 1 FROM posted_urls WHERE url = ?').get(url);
  return !!row;
}

export function markPosted(url: string, title: string): void {
  if (!db) throw new Error('DB not initialized. Call ensureDb() first.');
  db.prepare(
    'INSERT OR IGNORE INTO posted_urls (url, title, posted_at) VALUES (?, ?, ?)'
  ).run(url, title, Date.now());
}

export function getRecentlyPosted(hoursBack = 48): { url: string; title: string }[] {
  if (!db) throw new Error('DB not initialized. Call ensureDb() first.');
  const since = Date.now() - hoursBack * 60 * 60 * 1000;
  return db
    .prepare('SELECT url, title FROM posted_urls WHERE posted_at > ? ORDER BY posted_at DESC')
    .all(since) as { url: string; title: string }[];
}
