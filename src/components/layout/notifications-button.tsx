'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Bell, Check, XIcon, Crown, Pencil, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { ProcessingOverlay, type ProcessingStatus } from '@/components/processing-overlay';
import { cn } from '@/lib/utils';
import { setCurrentProjectId, acceptInvitation, rejectInvitation } from '@/features/projects/actions';
import type { PendingInvitation } from '@/features/projects/types';
import type { ProjectRole } from '@/features/projects/schemas';

// ============================================================================
// NOTIFICATIONS BUTTON
// ============================================================================

const roleLabels: Record<ProjectRole, { label: string; icon: typeof Crown }> = {
  owner: { label: 'Dueño', icon: Crown },
  editor: { label: 'Editor', icon: Pencil },
  viewer: { label: 'Lector', icon: Eye },
};

interface NotificationsButtonProps {
  invitations: PendingInvitation[];
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: () => void;
  direction?: 'right' | 'bottom';
  className?: string;
}

export function NotificationsButton({
  invitations,
  userId,
  isOpen,
  onOpenChange,
  onAction,
  direction = 'right',
  className,
}: NotificationsButtonProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overlayStatus, setOverlayStatus] = useState<ProcessingStatus>(null);
  const [processingProject, setProcessingProject] = useState<string | null>(null);

  const handleAccept = (invitation: PendingInvitation) => {
    setProcessingId(invitation.id);
    setProcessingProject(invitation.projectName);
    setOverlayStatus('loading');

    startTransition(async () => {
      const result = await acceptInvitation(invitation.id, userId);
      if (result.success) {
        // Cambiar al proyecto aceptado (en segundo plano)
        await setCurrentProjectId(invitation.projectId);
        // Refrescar datos
        onAction();
        // Mostrar éxito
        setOverlayStatus('success');
        // Después de mostrar el éxito, cerrar todo
        setTimeout(() => {
          setOverlayStatus(null);
          setProcessingProject(null);
          setProcessingId(null);
          onOpenChange(false);
        }, 3000);
      } else {
        toast.error(result.error);
        setOverlayStatus(null);
        setProcessingProject(null);
        setProcessingId(null);
      }
    });
  };

  const handleReject = (invitation: PendingInvitation) => {
    setProcessingId(invitation.id);
    const toastId = toast.loading('Rechazando invitación...');

    startTransition(async () => {
      const result = await rejectInvitation(invitation.id, userId);
      if (result.success) {
        toast.success('Invitación rechazada', { id: toastId });
        onAction();
      } else {
        toast.error(result.error, { id: toastId });
      }
      setProcessingId(null);
    });
  };

  const hasInvitations = invitations.length > 0;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction={direction}>
      <button
        type="button"
        aria-label={hasInvitations ? `Notificaciones, ${invitations.length} nuevas` : 'Notificaciones'}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted-foreground transition-colors hover:text-foreground',
          className
        )}
        onClick={() => onOpenChange(true)}
      >
        <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
        {hasInvitations && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-amber px-1 text-[10px] font-extrabold text-amber-ink">
            {invitations.length}
          </span>
        )}
      </button>
      <DrawerContent>
        <ProcessingOverlay
          status={overlayStatus}
          loadingText={`Cargando ${processingProject}...`}
          successText={`Bienvenido a ${processingProject}`}
        />
        <div className="flex flex-col h-full max-h-[85dvh]">
          <DrawerHeader className="border-b border-line">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle>Notificaciones</DrawerTitle>
                <DrawerDescription>
                  {hasInvitations
                    ? `${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} pendiente${invitations.length > 1 ? 's' : ''}`
                    : 'No tienes notificaciones'}
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {hasInvitations ? (
              <div className="space-y-3">
                {invitations.map((invitation) => {
                  const roleInfo = roleLabels[invitation.role];
                  const RoleIcon = roleInfo.icon;
                  const isProcessing = processingId === invitation.id;

                  return (
                    <div
                      key={invitation.id}
                      className="p-4 rounded-2xl border border-line bg-surface space-y-3"
                    >
                      <div>
                        <p className="font-medium">
                          Te han invitado a{' '}
                          <span className="text-jade">
                            {invitation.projectName}
                          </span>
                        </p>
                        {invitation.invitedByName && (
                          <p className="text-sm text-muted-foreground">
                            Invitado por {invitation.invitedByName}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <RoleIcon className="h-3.5 w-3.5" />
                        <span>Rol: {roleInfo.label}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-9"
                          disabled={isPending}
                          onClick={() => handleAccept(invitation)}
                        >
                          {isProcessing ? (
                            'Aceptando...'
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Aceptar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9"
                          disabled={isPending}
                          onClick={() => handleReject(invitation)}
                        >
                          {isProcessing ? (
                            'Rechazando...'
                          ) : (
                            <>
                              <XIcon className="h-4 w-4 mr-1" />
                              Rechazar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No tienes notificaciones</p>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
