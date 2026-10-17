import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revaluePensionAccounts, syncQuotaValues } from '@/features/pensions/lib/sync';
import { expireRelatedCache } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Compara el header con `Bearer $CRON_SECRET` sin filtrar información por el
 * tiempo de respuesta. Se comparan los SHA-256 para que el largo sea constante.
 */
function validCronAuth(received: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !received) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(`Bearer ${secret}`));
}

/**
 * Tarea diaria (Vercel Cron): guarda el valor cuota público y actualiza el saldo
 * de las cuentas de AFP / AFC. Vercel manda `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!validCronAuth(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const synced = await syncQuotaValues();
    const revalued = await revaluePensionAccounts();
    if (revalued.length) expireRelatedCache('accounts');
    return NextResponse.json({ ok: true, synced, revalued });
  } catch (error) {
    console.error('[cron] valor cuota', error);
    return NextResponse.json({ ok: false, error: 'Error al actualizar el valor cuota' }, { status: 500 });
  }
}
