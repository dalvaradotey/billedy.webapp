import { NextResponse } from 'next/server';
import { revaluePensionAccounts, syncQuotaValues } from '@/features/pensions/lib/sync';
import { expireRelatedCache } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tarea diaria (Vercel Cron): guarda el valor cuota público y actualiza el saldo
 * de las cuentas de AFP / AFC. Vercel manda `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const synced = await syncQuotaValues();
    const revalued = await revaluePensionAccounts();
    if (revalued.length) expireRelatedCache('accounts');
    return NextResponse.json({ ok: true, synced, revalued });
  } catch (error) {
    console.error('[cron] valor cuota', error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
