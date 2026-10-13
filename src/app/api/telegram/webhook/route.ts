import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { handleUpdate } from '@/features/telegram/bot';
import type { TelegramUpdate } from '@/features/telegram/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compara el secreto sin filtrar información por el tiempo de respuesta */
function validSecret(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook del bot de Telegram. Telegram manda el secreto configurado en
 * setWebhook en cada llamada; sin él, no se procesa nada.
 */
export async function POST(request: Request) {
  if (!validSecret(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    await handleUpdate(update);
  } catch (error) {
    // Responder 200 igual: si no, Telegram reintenta el mismo mensaje una y otra vez
    console.error('[telegram] error procesando update', error);
  }
  return NextResponse.json({ ok: true });
}
