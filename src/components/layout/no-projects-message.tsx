'use client';

import { useState, useTransition } from 'react';
import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createProject, setCurrentProjectId } from '@/features/projects/actions';
import type { Currency } from '@/features/projects/types';

interface NoProjectsMessageProps {
  userId: string;
  currencies: Currency[];
}

export function NoProjectsMessage({ userId, currencies }: NoProjectsMessageProps) {
  const router = useRouter();
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
        await setCurrentProjectId(result.data.id);
        router.refresh();
      } else {
        setError(result.error ?? 'Error al crear el proyecto');
      }
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FolderPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>No tienes proyectos</CardTitle>
          <CardDescription>
            Crea tu primer proyecto para comenzar a gestionar tus finanzas personales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nombre del proyecto</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Finanzas personales, Casa, Negocio"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moneda base</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger id="currency">
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

            <Button
              type="submit"
              disabled={!name.trim() || !currencyId || isSubmitting}
              className="w-full"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Creando...' : 'Crear proyecto'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
