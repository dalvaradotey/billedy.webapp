import { auth } from '.';

/**
 * Obtiene el id del usuario de la sesión en el servidor.
 * Las server actions deben usar esto en vez de recibir `userId` desde el cliente.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
