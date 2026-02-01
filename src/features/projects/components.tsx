'use client';

import { useState, useTransition } from 'react';
import { Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { CurrencyInput } from '@/components/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProject, updateProject } from './actions';
import type { Project, Currency } from './types';

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string;
  userId: string;
  currencies: Currency[];
  onProjectChange: (projectId: string) => void;
}

export function ProjectSelector({
  projects,
  currentProjectId,
  userId,
  currencies,
  onProjectChange,
}: ProjectSelectorProps) {
  const router = useRouter();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                    <Settings className="h-4 w-4" />
                    Editar proyecto
                  </button>
                </DialogTrigger>
                <EditProjectDialogContent
                  project={currentProject}
                  userId={userId}
                  onSuccess={() => {
                    setIsEditOpen(false);
                    router.refresh();
                  }}
                />
              </Dialog>
            )}
            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                  <Plus className="h-4 w-4" />
                  Nuevo proyecto
                </button>
              </DialogTrigger>
              <NewProjectDialogContent
                userId={userId}
                currencies={currencies}
                onSuccess={(id) => {
                  onProjectChange(id);
                  setIsNewOpen(false);
                }}
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
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Nuevo proyecto</DialogTitle>
        <DialogDescription>
          Un proyecto agrupa tus finanzas por contexto: personal, familia, negocio, etc.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-4">
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

        <DialogFooter>
          <Button type="submit" disabled={!name.trim() || !currencyId || isSubmitting} className="w-full h-12">
            {isSubmitting ? 'Creando...' : 'Crear proyecto'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Editar proyecto</DialogTitle>
        <DialogDescription>
          Modifica la configuración de tu proyecto.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-4">
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

        <DialogFooter>
          <Button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full h-12"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
