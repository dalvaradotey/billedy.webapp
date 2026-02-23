import { createInsertSchema } from 'drizzle-zod';
import { projects } from '@/lib/db/schema';
import { z } from 'zod';

export const createProjectSchema = createInsertSchema(projects, {
  name: z.string().min(1, 'El nombre es requerido').max(255),
})
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Hacemos baseCurrencyId opcional, se asigna CLP por defecto en el server
    baseCurrencyId: z.string().uuid().optional(),
  });

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ============================================================================
// PROJECT MEMBERS & INVITATIONS
// ============================================================================

export const projectRoles = ['owner', 'editor', 'viewer'] as const;
export type ProjectRole = (typeof projectRoles)[number];

export const inviteMemberSchema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  role: z.enum(projectRoles, { message: 'Selecciona un rol válido' }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
