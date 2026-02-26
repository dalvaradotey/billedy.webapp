'use client';

import { useTransition } from 'react';
import { Pencil, Trash2, MoreVertical } from 'lucide-react';
import { toastActions } from '@/lib/toast-messages';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { formatCurrency } from '@/lib/formatting';
import { deleteTemplateItem } from '../actions';
import type { TemplateItemWithDetails } from '../types';

interface TemplateItemRowProps {
  item: TemplateItemWithDetails;
  userId: string;
  baseCurrency: string;
  onEdit: () => void;
}

export function TemplateItemRow({ item, userId, baseCurrency, onEdit }: TemplateItemRowProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const { onSuccess, onError } = toastActions.deleting('item');
    startTransition(async () => {
      const result = await deleteTemplateItem(item.id, userId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error);
      }
    });
  };

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
      {/* Entity image */}
      {item.entityImageUrl ? (
        <img
          src={item.entityImageUrl}
          alt={item.entityName ?? ''}
          className="h-9 w-9 rounded-xl object-cover shrink-0 mt-0.5"
        />
      ) : (
        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {(item.entityName ?? item.description)?.[0]?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Title + Amount + Actions */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{item.description}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-sm font-semibold tabular-nums ${
                item.type === 'income'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {item.type === 'income' ? '+' : '-'}
              {formatCurrency(item.baseAmount, baseCurrency)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: Metadata - full width */}
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
          {item.entityName && <span>{item.entityName}</span>}
          <span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: item.categoryColor }}
          />
          <span>{item.categoryName}</span>
          {item.accountName && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{item.accountName}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
