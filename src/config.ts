import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

function require_env(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

export const config = {
  BOT_TOKEN: require_env('BOT_TOKEN'),
  CHANNEL_ID: require_env('CHANNEL_ID'),
  GEMINI_API_KEY: require_env('GEMINI_API_KEY'),
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 9 * * *',
  MAX_ITEMS_PER_SOURCE: parseInt(process.env.MAX_ITEMS_PER_SOURCE || '3', 10),
  HOURS_BACK: parseInt(process.env.HOURS_BACK || '24', 10),
};
