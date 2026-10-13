import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, telegramLinks } from '@/lib/db/schema';

export type TelegramStatus = {
  linked: boolean;
  linkedAt: Date | null;
  projectName: string | null;
  botUsername: string | null;
};

let botUsernameCache: string | null = null;

/** Usuario del bot (para el enlace t.me), leído de la API una vez */
async function getBotUsername(): Promise<string | null> {
  if (botUsernameCache) return botUsernameCache;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' });
    const json = (await res.json()) as { ok: boolean; result?: { username?: string } };
    botUsernameCache = json.result?.username ?? null;
  } catch {
    botUsernameCache = null;
  }
  return botUsernameCache;
}

export async function getTelegramStatus(userId: string): Promise<TelegramStatus> {
  const [row] = await db
    .select({ chatId: telegramLinks.chatId, linkedAt: telegramLinks.linkedAt, projectName: projects.name })
    .from(telegramLinks)
    .leftJoin(projects, eq(projects.id, telegramLinks.projectId))
    .where(eq(telegramLinks.userId, userId))
    .limit(1);
  return {
    linked: row?.chatId != null,
    linkedAt: row?.linkedAt ?? null,
    projectName: row?.projectName ?? null,
    botUsername: await getBotUsername(),
  };
}
