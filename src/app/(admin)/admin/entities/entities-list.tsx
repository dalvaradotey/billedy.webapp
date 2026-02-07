'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  createEntity,
  updateEntity,
  deleteEntity,
  activateEntity,
  deactivateEntity,
} from '@/features/entities/actions';
import type { Entity, EntityType } from '@/features/entities/types';
import { entityTypeLabels } from '@/features/entities/types';

interface EntitiesListProps {
  entities: Entity[];
  userId: string;
}

export function EntitiesList({ entities, userId }: EntitiesListProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ResponsiveDrawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DrawerTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva entidad
            </Button>
          </DrawerTrigger>
          {isCreateOpen && (
            <EntityFormDialog
              userId={userId}
              onSuccess={() => {
                setIsCreateOpen(false);
                router.refresh();
              }}
            />
          )}
        </ResponsiveDrawer>
      </div>

      {entities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay entidades registradas. Crea la primera.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              userId={userId}
              onEdit={() => setEditingEntity(entity)}
            />
          ))}
        </div>
      )}

      {editingEntity && (
        <ResponsiveDrawer open={!!editingEntity} onOpenChange={() => setEditingEntity(null)}>
          <EntityFormDialog
            userId={userId}
            entity={editingEntity}
            onSuccess={() => {
              setEditingEntity(null);
              router.refresh();
            }}
          />
        </ResponsiveDrawer>
      )}
    </div>
  );
}

interface EntityCardProps {
  entity: Entity;
  userId: string;
  onEdit: () => void;
}

function EntityCard({ entity, userId, onEdit }: EntityCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggleActive = () => {
    startTransition(async () => {
      if (entity.isActive) {
        await deactivateEntity(entity.id, userId);
      } else {
        await activateEntity(entity.id, userId);
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm('¿Estás seguro de eliminar esta entidad permanentemente?')) {
      return;
    }
    startTransition(async () => {
      await deleteEntity(entity.id, userId);
      router.refresh();
    });
  };

  return (
    <Card className={!entity.isActive ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {entity.imageUrl ? (
              <Image
                src={entity.imageUrl}
                alt={entity.name}
                width={48}
                height={48}
                className="object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-muted-foreground">
                {entity.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{entity.name}</h3>
              {!entity.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactiva
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {entityTypeLabels[entity.type as EntityType]}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleActive}
            disabled={isPending}
            title={entity.isActive ? 'Desactivar' : 'Activar'}
          >
            {entity.isActive ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            disabled={isPending}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface EntityFormDialogProps {
  userId: string;
  entity?: Entity;
  onSuccess: () => void;
}

function EntityFormDialog({ userId, entity, onSuccess }: EntityFormDialogProps) {
  const [name, setName] = useState(entity?.name ?? '');
  const [type, setType] = useState<EntityType>(entity?.type as EntityType ?? 'other');
  const [imagePreview, setImagePreview] = useState<string | null>(entity?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar los 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setImageFile(base64);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = { name, type };

      const result = entity
        ? await updateEntity(entity.id, userId, input, imageFile ?? undefined)
        : await createEntity(userId, input, imageFile ?? undefined);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    });
  };

  const entityTypes: EntityType[] = [
    'bank',
    'credit_card',
    'supermarket',
    'pharmacy',
    'store',
    'restaurant',
    'service',
    'utility',
    'government',
    'hardware_store',
    'mechanic',
    'streaming',
    'grocery_store',
    'other',
  ];

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{entity ? 'Editar entidad' : 'Nueva entidad'}</DrawerTitle>
          <DrawerDescription>
            {entity
              ? 'Modifica los datos de la entidad.'
              : 'Agrega una nueva entidad al sistema.'}
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="flex justify-center">
          <div
            className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt="Preview"
                width={96}
                height={96}
                className="object-cover"
              />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-2">
                Click para subir imagen
              </span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Banco de Chile, Lider, Cruz Verde"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
            <SelectTrigger id="type" className="h-12">
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {entityTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DrawerFooter className="pt-4">
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              className="w-full h-12"
            >
              {isPending
                ? 'Guardando...'
                : entity
                ? 'Guardar cambios'
                : 'Crear entidad'}
            </Button>
          </DrawerFooter>
        </form>
      </div>
    </DrawerContent>
  );
}
