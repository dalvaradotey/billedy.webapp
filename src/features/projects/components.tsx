'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createMonthProject, createProject } from './actions';
import type { Project } from './types';

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string;
  userId: string;
  onProjectChange: (projectId: string) => void;
}

export function ProjectSelector({
  projects,
  currentProjectId,
  userId,
  onProjectChange,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleCreateMonthProject = () => {
    startTransition(async () => {
      const result = await createMonthProject(userId);
      if (result.success) {
        onProjectChange(result.data.id);
        setIsOpen(false);
      }
    });
  };

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
          <div className="border-t mt-1 pt-1">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                  <Plus className="h-4 w-4" />
                  Nuevo proyecto
                </button>
              </DialogTrigger>
              <NewProjectDialogContent
                userId={userId}
                onSuccess={(id) => {
                  onProjectChange(id);
                  setIsOpen(false);
                }}
                onCreateMonth={handleCreateMonthProject}
                isPending={isPending}
              />
            </Dialog>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}

interface NewProjectDialogContentProps {
  userId: string;
  onSuccess: (projectId: string) => void;
  onCreateMonth: () => void;
  isPending: boolean;
}

function NewProjectDialogContent({
  userId,
  onSuccess,
  onCreateMonth,
  isPending,
}: NewProjectDialogContentProps) {
  const [name, setName] = useState('');
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      // Obtener CLP currency - simplificado, asumimos que existe
      const result = await createProject(userId, {
        name,
        baseCurrencyId: '', // Se llenará en el server
        currency: 'CLP',
      });

      if (result.success) {
        onSuccess(result.data.id);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Nuevo proyecto</DialogTitle>
        <DialogDescription>
          Crea un nuevo período financiero para organizar tus finanzas.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 h-12"
          onClick={onCreateMonth}
          disabled={isPending}
        >
          <Calendar className="h-4 w-4" />
          Crear mes actual
          <span className="ml-auto text-muted-foreground text-xs">
            {new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
          </span>
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">o nombre personalizado</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del proyecto</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Vacaciones 2026"
              className="h-12"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || isSubmitting} className="w-full h-12">
              {isSubmitting ? 'Creando...' : 'Crear proyecto'}
            </Button>
          </DialogFooter>
        </form>
      </div>
    </DialogContent>
  );
}
