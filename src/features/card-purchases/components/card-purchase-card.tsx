'use client';

import { useState } from 'react';
import {
  CreditCard,
  Store,
  MoreHorizontal,
  Trash2,
  Archive,
  Receipt,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { formatCurrency, formatDateLong } from '@/lib/formatting';
import { chargeInstallment, archiveCardPurchase, deleteCardPurchase } from '../actions';
import type { CardPurchaseWithDetails } from '../types';

interface CardPurchaseCardProps {
  purchase: CardPurchaseWithDetails;
  userId: string;
  onUpdate: () => void;
}

const CONFIRM_DELETE_TEXT = 'ELIMINAR';

export function CardPurchaseCard({ purchase, userId, onUpdate }: CardPurchaseCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const hasInterest = parseFloat(purchase.interestAmount) > 0;
  const isOverdue = purchase.nextChargeDate && new Date(purchase.nextChargeDate) < new Date();
  const canDelete = confirmText === CONFIRM_DELETE_TEXT;

  const handleChargeInstallment = async () => {
    setIsLoading(true);
    const result = await chargeInstallment(purchase.id, userId);
    setIsLoading(false);
    if (result.success) {
      onUpdate();
    }
  };

  const handleArchive = async () => {
    setIsLoading(true);
    const result = await archiveCardPurchase(purchase.id, userId);
    setIsLoading(false);
    if (result.success) {
      onUpdate();
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsLoading(true);
    const result = await deleteCardPurchase(purchase.id, userId);
    setIsLoading(false);
    setShowDeleteAlert(false);
    setConfirmText('');
    if (result.success) {
      onUpdate();
    }
  };

  const handleCloseDeleteAlert = (open: boolean) => {
    setShowDeleteAlert(open);
    if (!open) {
      setConfirmText('');
    }
  };

  return (
    <>
      <Card className={!purchase.isActive ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {purchase.description}
                {purchase.isExternalDebt && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    Externa
                  </Badge>
                )}
                {!purchase.isActive && (
                  <Badge variant="secondary">Completada</Badge>
                )}
                {isOverdue && purchase.isActive && (
                  <Badge variant="destructive">Pendiente</Badge>
                )}
              </CardTitle>
              {/* Entity or Store Name */}
              {(purchase.entityName || purchase.storeName) && (
                <CardDescription className="flex items-center gap-2">
                  {purchase.entityImageUrl ? (
                    <img
                      src={purchase.entityImageUrl}
                      alt={purchase.entityName ?? ''}
                      className="h-5 w-5 rounded object-contain bg-white shrink-0"
                    />
                  ) : (
                    <Store className="h-4 w-4 shrink-0" />
                  )}
                  {purchase.entityName ?? purchase.storeName}
                </CardDescription>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isLoading}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {purchase.isActive && purchase.remainingInstallments > 0 && (
                  <DropdownMenuItem onClick={handleChargeInstallment}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Cobrar cuota
                  </DropdownMenuItem>
                )}
                {purchase.isActive && (
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">
                {purchase.chargedInstallments} de {purchase.installments} cuotas
              </span>
            </div>
            <Progress value={purchase.progressPercentage} className="h-2" />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Monto original</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(purchase.originalAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Cuota mensual</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(purchase.installmentAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">
                {hasInterest ? 'Total con interés' : 'Total'}
              </span>
              <span className="font-medium">
                {formatCurrency(parseFloat(purchase.totalAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Interés</span>
              {hasInterest ? (
                <span className="font-medium text-destructive">
                  +{formatCurrency(parseFloat(purchase.interestAmount))}
                  {purchase.interestRate && (
                    <span className="text-xs ml-1">({purchase.interestRate}%)</span>
                  )}
                </span>
              ) : (
                <span className="font-medium text-green-600">Sin interés</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground block">Restante</span>
              <span className="font-medium">
                {formatCurrency(purchase.remainingAmount)}
              </span>
            </div>
            {purchase.nextChargeDate && purchase.isActive && (
              <div>
                <span className="text-muted-foreground block">Próximo vencimiento</span>
                <span className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                  {formatDateLong(purchase.nextChargeDate)}
                </span>
              </div>
            )}
          </div>

          {/* Footer info */}
          <Separator />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {purchase.accountEntityImageUrl ? (
                <img
                  src={purchase.accountEntityImageUrl}
                  alt={purchase.accountEntityName ?? purchase.accountName}
                  className="h-4 w-4 rounded object-contain bg-white shrink-0"
                />
              ) : (
                <CreditCard className="h-3 w-3 shrink-0" />
              )}
              {purchase.accountName}
            </div>
            {purchase.categoryName && (
              <div className="flex items-center gap-1">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: purchase.categoryColor || '#6b7280' }}
                />
                {purchase.categoryName}
              </div>
            )}
            <div>
              {formatDateLong(purchase.purchaseDate)}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteAlert} onOpenChange={handleCloseDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ¿Eliminar compra permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará la compra
                &quot;{purchase.description}&quot; junto con todas las{' '}
                <strong>{purchase.chargedInstallments} transacciones</strong> asociadas.
              </span>
              <span className="block">
                Para confirmar, escribe <strong>{CONFIRM_DELETE_TEXT}</strong> a continuación:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              placeholder={`Escribe ${CONFIRM_DELETE_TEXT} para confirmar`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className={confirmText && !canDelete ? 'border-destructive' : ''}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isLoading ? 'Eliminando...' : 'Eliminar compra y transacciones'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
