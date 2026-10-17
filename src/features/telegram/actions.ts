'use server';

import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { telegramLinks } from '@/lib/db/schema';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { NO_PROJECT_ACCESS, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import type { ActionResult } from '@/types/action-result';

/** Sin letras que se confunden (0/O, 1/I/L) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_TTL_MS = 15 * 60 * 1000;

/**
 * Genera un código de un solo uso (vence en 15 minutos) para conectar el chat
 * de Telegram del usuario con el proyecto actual.
 */
export async function createTelegramLinkCode(
  userId: string,
  projectId: string
): Promise<ActionResult<{ code: string; expiresAt: Date }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  // El bot registra movimientos en el proyecto: exige rol que pueda modificar
  if (!(await verifyProjectWriteAccess(projectId, userId))) return { success: false, error: NO_PROJECT_ACCESS };

  const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db
    .insert(telegramLinks)
    .values({ userId, projectId, linkCode: code, codeExpiresAt: expiresAt })
    .onConflictDoUpdate({
      target: telegramLinks.userId,
      set: { projectId, linkCode: code, codeExpiresAt: expiresAt, updatedAt: new Date() },
    });

  return { success: true, data: { code, expiresAt } };
}

/** Desconecta el chat: el bot deja de responderle */
export async function unlinkTelegram(userId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  await db.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
  return { success: true, data: undefined };
}
