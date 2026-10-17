/**
 * Resultado de una server action: éxito con datos o error para mostrar al usuario.
 * El mensaje de error debe ser legible; nunca un error interno de la BD.
 */
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };
