import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import type { NewsItem } from '../sources';

const genai = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function generateSinglePost(item: NewsItem): Promise<string> {
  const today = new Date().toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'long',
  });

  const prompt = `Sen AI yangiliklari haqida o'zbek tilida yozuvchi. Quyidagi yangilik asosida Telegram kanalga post yoz.

Yangilik: ${item.title}
Manba: ${item.source}
${item.summary ? `Ma'lumot: ${item.summary}` : ''}

Misol uchun qanday yozilishi kerak:
"${today} kuni Claude yangi Opus 4.8 modelini taqdim etdi. U avvalgi versiyaga qaraganda ancha kuchliroq — ayniqsa kod yozishda. Eng qiziqarlisi, OpusPlan mode bor: Opus bilan reja tuzib, Sonnet bilan kod yozdirsangiz token tejaysiz."

QOIDALAR:
- O'zbek tilida, suhbat ohangida yoz
- Sana bilan boshlash shart emas, lekin yozsa bo'ladi
- Nima chiqdi yoki nima o'zgardi — 1-2 gap
- Eng muhim yoki qiziqarli jihati — 1-2 gap
- Ixtiyoriy: qanday ishlatish, qanday foyda beradi — 1 gap
- Emoji: 2-4 ta, haddan oshirma
- Uzunlik: 80-180 so'z
- HTML teglari ISHLATMA
- Havola QO'SHMA (alohida qo'shiladi)

Faqat post matnini ber.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
