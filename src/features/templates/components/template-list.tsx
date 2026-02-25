'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowRight,
  FileText,
  Layers,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer, DrawerTrigger } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';

import { formatCurrency } from '@/lib/formatting';
import type { TemplateWithItems, TemplatesSummary } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import { TemplateCard } from './template-card';
import { TemplateDialogContent } from './template-dialog';

interface TemplateListProps {
  templates: TemplateWithItems[];
  categories: { id: string; name: string; color: string }[];
  accounts: AccountWithEntity[];
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
  const router = useRouter();
  const pathname = usePathname();
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

  const handleFilterChange = (archived: boolean) => {
    if (archived) {
      router.push(`${pathname}?archived=true`);
    } else {
      router.push(pathname);
    }
  };

  // Filter templates based on the selected tab
  const displayedTemplates = showArchived
    ? templates.filter((t) => t.isArchived)
    : templates.filter((t) => !t.isArchived);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Plantillas Activas"
          value={String(summary.activeTemplates)}
          subtitle={`de ${summary.totalTemplates} totales · ${summary.totalItems} items`}
          icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
        <SummaryCard
          title="Items Totales"
          value={String(summary.totalItems)}
          subtitle="en todas las plantillas"
          icon={<Layers className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="neutral"
        />
        <SummaryCard
          title="Ingresos Mensuales"
          value={formatCurrency(summary.totalMonthlyIncome, baseCurrency)}
          subtitle="estimado por ciclo"
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <SummaryCard
          title="Gastos Mensuales"
          value={formatCurrency(summary.totalMonthlyExpense, baseCurrency)}
          subtitle="estimado por ciclo"
          icon={<TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="danger"
        />
      </SummaryCardsSlider>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          <button
            onClick={() => handleFilterChange(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !showArchived
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activas
            <span className="ml-1 tabular-nums opacity-60">{summary.activeTemplates}</span>
          </button>
          <button
            onClick={() => handleFilterChange(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              showArchived
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archivadas
          </button>
        </div>

        <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerTrigger asChild>
            <Button variant="cta-sm" onClick={handleOpenDialog}>
              Nueva plantilla
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <TemplateDialogContent
            projectId={projectId}
            userId={userId}
            template={editingTemplate}
            onSuccess={handleDialogClose}
          />
        </ResponsiveDrawer>
      </div>

      {/* Templates List */}
      <div>
        {displayedTemplates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={showArchived ? 'No hay plantillas archivadas' : 'No hay plantillas configuradas'}
            description="Crea una plantilla para automatizar tus transacciones recurrentes."
          />
        ) : (
          <div className="space-y-3">
            {displayedTemplates.map((template) => (
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
    </div>
  );
}
