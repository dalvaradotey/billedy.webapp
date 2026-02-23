'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Settings, UserPlus, Users, Trash2, Crown, Pencil, Eye, ArrowRight, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSuccessAnimation } from '@/hooks';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { SubmitButton } from '@/components/submit-button';
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select';
import { UserSearchSelector, type UserSearchResult } from '@/components/user-search-selector';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createProject, updateProject, inviteMember, removeMember, searchUsersForInvite } from './actions';
import type { Project, Currency, ProjectMemberWithUser } from './types';
import type { ProjectRole } from './schemas';

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string;
  userId: string;
  currencies: Currency[];
  members?: ProjectMemberWithUser[];
  isOwner?: boolean;
  onProjectChange: (projectId: string) => void;
}

export function ProjectSelector({
  projects,
  currentProjectId,
  userId,
  currencies,
  members = [],
  isOwner = false,
  onProjectChange,
}: ProjectSelectorProps) {
  const router = useRouter();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  return (
    <div className="flex items-center gap-2">
      <Select value={currentProjectId} onValueChange={onProjectChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Seleccionar proyecto">
            {currentProject?.name ?? 'Seleccionar'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
          <div className="border-t mt-1 pt-1 space-y-1">
            {currentProject && (
              <>
                <ResponsiveDrawer open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DrawerTrigger asChild>
                    <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                      <Settings className="h-4 w-4" />
                      Editar proyecto
                    </button>
                  </DrawerTrigger>
                  <EditProjectDialogContent
                    project={currentProject}
                    userId={userId}
                    onSuccess={() => {
                      setIsEditOpen(false);
                      router.refresh();
                    }}
                  />
                </ResponsiveDrawer>

                {/* Ver miembros del proyecto */}
                <ResponsiveDrawer open={isMembersOpen} onOpenChange={setIsMembersOpen}>
                  <DrawerTrigger asChild>
                    <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                      <Users className="h-4 w-4" />
                      Ver miembros
                    </button>
                  </DrawerTrigger>
                  <MembersDialogContent
                    projectId={currentProjectId}
                    members={members}
                    isOwner={isOwner}
                    userId={userId}
                    onSuccess={() => {
                      router.refresh();
                    }}
                    onClose={() => setIsMembersOpen(false)}
                  />
                </ResponsiveDrawer>

                {/* Invitar miembro (solo owner) */}
                {isOwner && (
                  <ResponsiveDrawer open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DrawerTrigger asChild>
                      <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm text-emerald-600 dark:text-emerald-400">
                        <UserPlus className="h-4 w-4" />
                        Invitar miembro
                      </button>
                    </DrawerTrigger>
                    <InviteMemberDialogContent
                      projectId={currentProjectId}
                      userId={userId}
                      onSuccess={() => {
                        setIsInviteOpen(false);
                        router.refresh();
                      }}
                    />
                  </ResponsiveDrawer>
                )}
              </>
            )}
            <ResponsiveDrawer open={isNewOpen} onOpenChange={setIsNewOpen}>
              <DrawerTrigger asChild>
                <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                  <Plus className="h-4 w-4" />
                  Nuevo proyecto
                </button>
              </DrawerTrigger>
              <NewProjectDialogContent
                userId={userId}
                currencies={currencies}
                onSuccess={(id) => {
                  onProjectChange(id);
                  setIsNewOpen(false);
                }}
              />
            </ResponsiveDrawer>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}

interface NewProjectDialogContentProps {
  userId: string;
  currencies: Currency[];
  onSuccess: (projectId: string) => void;
}

function NewProjectDialogContent({
  userId,
  currencies,
  onSuccess,
}: NewProjectDialogContentProps) {
  const [name, setName] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Encontrar la moneda seleccionada para obtener el código
  const selectedCurrency = currencies.find((c) => c.id === currencyId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currencyId) {
      setError('Selecciona una moneda');
      return;
    }

    startTransition(async () => {
      const result = await createProject(userId, {
        name,
        baseCurrencyId: currencyId,
        currency: selectedCurrency?.code ?? 'CLP',
      });

      if (result.success) {
        onSuccess(result.data.id);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Nuevo proyecto</DrawerTitle>
          <DrawerDescription>
            Un proyecto agrupa tus finanzas por contexto: personal, familia, negocio, etc.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del proyecto</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Finanzas personales, Casa, Negocio"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dialog-currency">Moneda base</Label>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger id="dialog-currency" className="h-12">
                <SelectValue placeholder="Selecciona una moneda" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.code} - {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DrawerFooter className="pt-4">
            <Button type="submit" disabled={!name.trim() || !currencyId || isSubmitting} className="w-full h-12">
              {isSubmitting ? 'Creando...' : 'Crear proyecto'}
            </Button>
          </DrawerFooter>
        </form>
      </div>
    </DrawerContent>
  );
}

interface EditProjectDialogContentProps {
  project: Project;
  userId: string;
  onSuccess: () => void;
}

function EditProjectDialogContent({
  project,
  userId,
  onSuccess,
}: EditProjectDialogContentProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [maxInstallmentAmount, setMaxInstallmentAmount] = useState<number | undefined>(
    project.maxInstallmentAmount ? parseFloat(project.maxInstallmentAmount) : undefined
  );
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateProject(project.id, userId, {
        name,
        description: description || undefined,
        maxInstallmentAmount: maxInstallmentAmount !== undefined
          ? String(maxInstallmentAmount)
          : undefined,
      });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Editar proyecto</DrawerTitle>
          <DrawerDescription>
            Modifica la configuración de tu proyecto.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre del proyecto</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Finanzas personales, Casa, Negocio"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción (opcional)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el propósito de este proyecto"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-max-installment">
              Límite de cuotas mensuales (opcional)
            </Label>
            <CurrencyInput
              value={maxInstallmentAmount}
              onChange={setMaxInstallmentAmount}
              placeholder="Ej: 500.000"
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              Monto máximo que puedes comprometer en cuotas mensuales
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DrawerFooter className="pt-4">
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="w-full h-12"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DrawerFooter>
        </form>
      </div>
    </DrawerContent>
  );
}

// ============================================================================
// INVITE MEMBER DIALOG
// ============================================================================

interface InviteMemberDialogContentProps {
  projectId: string;
  userId: string;
  onSuccess: () => void;
}

// Role options for the selector
const roleOptions: SearchableSelectOption[] = [
  {
    id: 'viewer',
    label: 'Lector',
    icon: <Eye className="h-4 w-4 text-muted-foreground" />,
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: <Pencil className="h-4 w-4 text-muted-foreground" />,
  },
];

function InviteMemberDialogContent({
  projectId,
  userId,
  onSuccess,
}: InviteMemberDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [role, setRole] = useState<string>('viewer');
  const [error, setError] = useState<string | null>(null);

  // Form UX hooks
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

  // Crear función de búsqueda con userId capturado
  const searchUsers = async (query: string) => {
    return searchUsersForInvite(query, userId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUser) {
      setError('Selecciona un usuario');
      return;
    }

    const toastId = toast.loading('Enviando invitación...');

    startTransition(async () => {
      const result = await inviteMember(projectId, userId, {
        email: selectedUser.email,
        role: role as 'viewer' | 'editor',
      });

      if (result.success) {
        toast.success('Invitación enviada', { id: toastId });
        setSelectedUser(null);
        setRole('viewer');
        triggerSuccess();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  return (
    <FormDrawer
      title="Invitar miembro"
      description="Invita a otra persona a colaborar en este proyecto."
      showSuccess={showSuccess}
    >
      <FormDrawerBody as="form" onSubmit={handleSubmit}>
        {/* User Search */}
        <div className="space-y-1">
          <UserSearchSelector
            value={selectedUser}
            onValueChange={setSelectedUser}
            searchAction={searchUsers}
            label="Usuario"
            searchPlaceholder="Buscar por correo..."
            emptyMessage="No se encontraron usuarios con ese correo."
            valid={!!selectedUser}
            invalid={!!error && !selectedUser}
          />
          <p className="text-xs text-muted-foreground">
            Busca por correo electrónico
          </p>
        </div>

        {/* Role */}
        <SearchableSelect
          options={roleOptions}
          value={role}
          onValueChange={(value) => setRole(value ?? 'viewer')}
          label="Rol"
          searchPlaceholder="Buscar rol..."
          emptyMessage="No se encontraron roles."
          valid={!!role}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <FormDrawerFooter>
          <SubmitButton
            isPending={isPending}
            pendingText="Enviando..."
            icon={<ArrowRight className="h-4 w-4" />}
            disabled={!selectedUser}
          >
            Enviar invitación
          </SubmitButton>
        </FormDrawerFooter>
      </FormDrawerBody>
    </FormDrawer>
  );
}

// ============================================================================
// MEMBERS DIALOG
// ============================================================================

interface MembersDialogContentProps {
  projectId: string;
  members: ProjectMemberWithUser[];
  isOwner: boolean;
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const roleLabels: Record<ProjectRole, { label: string; icon: typeof Crown }> = {
  owner: { label: 'Dueño', icon: Crown },
  editor: { label: 'Editor', icon: Pencil },
  viewer: { label: 'Lector', icon: Eye },
};

function MembersDialogContent({
  projectId,
  members,
  isOwner,
  userId,
  onSuccess,
  onClose,
}: MembersDialogContentProps) {
  const [memberToRemove, setMemberToRemove] = useState<ProjectMemberWithUser | null>(null);
  const [isRemoving, startTransition] = useTransition();

  // Separar miembros aceptados de pendientes
  const acceptedMembers = members.filter((m) => m.acceptedAt);
  const pendingMembers = members.filter((m) => !m.acceptedAt);

  const handleRemove = () => {
    if (!memberToRemove) return;

    const toastId = toast.loading(
      memberToRemove.acceptedAt ? 'Eliminando miembro...' : 'Cancelando invitación...'
    );

    startTransition(async () => {
      const result = await removeMember(projectId, memberToRemove.id, userId);
      if (result.success) {
        toast.success(
          memberToRemove.acceptedAt ? 'Miembro eliminado' : 'Invitación cancelada',
          { id: toastId }
        );
        setMemberToRemove(null);
        onSuccess();
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const renderMemberCard = (member: ProjectMemberWithUser) => {
    const roleInfo = roleLabels[member.role as ProjectRole];
    const RoleIcon = roleInfo.icon;
    const isPending = !member.acceptedAt;
    const initials = member.userName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? member.userEmail[0].toUpperCase();

    return (
      <div
        key={member.id}
        className={`flex items-center justify-between p-3 rounded-lg border bg-card ${
          isPending ? 'opacity-70 border-dashed' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <Avatar className={`h-10 w-10 ${isPending ? 'grayscale' : ''}`}>
            <AvatarImage src={member.userImage ?? undefined} alt={member.userName ?? ''} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium truncate">
              {member.userName ?? member.userEmail}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <RoleIcon className="h-3 w-3" />
                {roleInfo.label}
              </span>
              {isPending && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  Pendiente
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Solo el owner puede eliminar miembros (excepto a sí mismo) */}
        {isOwner && member.role !== 'owner' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={() => setMemberToRemove(member)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Miembros del proyecto</DrawerTitle>
          <DrawerDescription>
            {acceptedMembers.length} {acceptedMembers.length === 1 ? 'miembro' : 'miembros'}
            {pendingMembers.length > 0 && (
              <> · {pendingMembers.length} {pendingMembers.length === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}</>
            )}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="space-y-4">
            {/* Miembros activos */}
            {acceptedMembers.length > 0 && (
              <div className="space-y-2">
                {acceptedMembers.map(renderMemberCard)}
              </div>
            )}

            {/* Invitaciones pendientes */}
            {pendingMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Invitaciones pendientes
                </p>
                {pendingMembers.map(renderMemberCard)}
              </div>
            )}
          </div>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose} className="w-full h-12">
            Cerrar
          </Button>
        </DrawerFooter>
      </div>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title={memberToRemove?.acceptedAt ? 'Eliminar miembro' : 'Cancelar invitación'}
        description={
          memberToRemove?.acceptedAt
            ? `¿Estás seguro de que deseas eliminar a ${memberToRemove?.userName ?? memberToRemove?.userEmail} del proyecto? Esta acción no se puede deshacer.`
            : `¿Estás seguro de que deseas cancelar la invitación de ${memberToRemove?.userName ?? memberToRemove?.userEmail}?`
        }
        confirmText={
          isRemoving
            ? memberToRemove?.acceptedAt ? 'Eliminando...' : 'Cancelando...'
            : memberToRemove?.acceptedAt ? 'Eliminar' : 'Cancelar invitación'
        }
        onConfirm={handleRemove}
        variant="destructive"
      />
    </DrawerContent>
  );
}
