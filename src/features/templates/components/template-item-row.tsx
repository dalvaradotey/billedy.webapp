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
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
      <div className="flex items-center gap-3">
        {item.entityImageUrl && (
          <img
            src={item.entityImageUrl}
            alt={item.entityName ?? ''}
            className="h-6 w-6 rounded-full object-cover"
          />
        )}
        <div>
          <p className="text-sm font-medium">{item.description}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {item.entityName && <span>{item.entityName} • </span>}
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.categoryColor }}
            />
            {item.categoryName}
            {item.accountName && <span> • {item.accountName}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${
            item.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {item.type === 'income' ? '+' : '-'}
          {formatCurrency(item.baseAmount, baseCurrency)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
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
  );
}
