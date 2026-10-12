import { auth } from '.';

export const UNAUTHORIZED_ERROR = 'Tu sesión expiró. Vuelve a iniciar sesión.';

/**
 * Obtiene el id del usuario de la sesión en el servidor.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Verifica que el `userId` que llega a una server action sea el de la sesión.
 * Las server actions son endpoints públicos: sin esto, cualquiera podría
 * llamarlas con el id de otro usuario (la BD no tiene RLS).
 */
export async function isSessionUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await requireUserId()) === userId;
}
