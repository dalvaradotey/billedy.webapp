'use client';

import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import type { TemplateWithItems, TemplatesSummary } from '../types';
import { TemplateCard } from './template-card';
import { TemplateDialogContent } from './template-dialog';

interface TemplateListProps {
  templates: TemplateWithItems[];
  categories: { id: string; name: string; color: string }[];
  accounts: { id: string; name: string }[];
  entities: { id: string; name: string; type: string; imageUrl: string | null }[];
  summary: TemplatesSummary;
  projectId: string;
  userId: string;
  baseCurrency: string;
  showArchived: boolean;
}

export function TemplateList({
  templates,
  categories,
  accounts,
  entities,
  summary,
  projectId,
  userId,
  baseCurrency,
  showArchived,
}: TemplateListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithItems | null>(null);

  const handleEdit = (template: TemplateWithItems) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleOpenDialog = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const activeTemplates = templates.filter((t) => !t.isArchived);
  const archivedTemplates = templates.filter((t) => t.isArchived);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Plantillas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeTemplates}</div>
            <p className="text-xs text-muted-foreground">
              de {summary.totalTemplates} totales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingresos Mensuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalMonthlyIncome, baseCurrency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gastos Mensuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalMonthlyExpense, baseCurrency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Plantillas</h2>
          <p className="text-sm text-muted-foreground">
            Configura los items recurrentes que se cargarán en cada ciclo
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          </DialogTrigger>
          <TemplateDialogContent
            projectId={projectId}
            userId={userId}
            template={editingTemplate}
            onSuccess={handleDialogClose}
          />
        </Dialog>
      </div>

      {/* Templates List */}
      {activeTemplates.length === 0 && archivedTemplates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay plantillas configuradas"
          description="Crea una plantilla para automatizar tus transacciones recurrentes."
        />
      ) : (
        <div className="space-y-4">
          {activeTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              categories={categories}
              accounts={accounts}
              entities={entities}
              projectId={projectId}
              userId={userId}
              baseCurrency={baseCurrency}
              onEdit={() => handleEdit(template)}
            />
          ))}

          {showArchived && archivedTemplates.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Plantillas archivadas
              </h3>
              {archivedTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  categories={categories}
                  accounts={accounts}
                  entities={entities}
                  projectId={projectId}
                  userId={userId}
                  baseCurrency={baseCurrency}
                  onEdit={() => handleEdit(template)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
