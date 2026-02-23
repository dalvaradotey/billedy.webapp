import type { InferSelectModel } from 'drizzle-orm';
import type { projects, currencies, projectMembers } from '@/lib/db/schema';
import type { ProjectRole } from './schemas';

export type Project = InferSelectModel<typeof projects>;

export type Currency = InferSelectModel<typeof currencies>;

export type ProjectWithCurrency = Project & {
  currencySymbol: string;
  currencyName: string;
};

// ============================================================================
// PROJECT MEMBERS & INVITATIONS
// ============================================================================

export type ProjectMember = InferSelectModel<typeof projectMembers>;

export type ProjectMemberWithUser = ProjectMember & {
  userName: string | null;
  userEmail: string;
  userImage: string | null;
};

export type PendingInvitation = {
  id: string;
  projectId: string;
  projectName: string;
  role: ProjectRole;
  invitedByName: string | null;
  invitedByEmail: string | null;
  invitedAt: Date;
};
