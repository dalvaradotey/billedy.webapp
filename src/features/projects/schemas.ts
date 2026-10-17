import { z } from 'zod';

/**
 * Campos que el usuario puede definir al crear un proyecto. Explícitos a
 * propósito: el resto de columnas (meta de ahorro, cuenta de contingencia,
 * techo de TC, archivado…) se editan por sus propias actions.
 */
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  description: z.string().max(500).nullish(),
  // Opcional: se asigna CLP por defecto en el server
  baseCurrencyId: z.string().uuid().optional(),
  currency: z.string().length(3, 'Moneda inválida'),
});

/** Campos editables de un proyecto existente (la moneda no cambia) */
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255).optional(),
  description: z.string().max(500).nullish(),
  maxInstallmentAmount: z
    .string()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, 'Monto inválido')
    .nullish(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ============================================================================
// PROJECT MEMBERS & INVITATIONS
// ============================================================================

export const projectRoles = ['owner', 'editor', 'viewer'] as const;
export type ProjectRole = (typeof projectRoles)[number];

/** Roles que se pueden asignar al invitar: el owner es único (el creador) */
export const inviteRoles = ['editor', 'viewer'] as const;

export const inviteMemberSchema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  role: z.enum(inviteRoles, { message: 'Selecciona un rol válido' }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
