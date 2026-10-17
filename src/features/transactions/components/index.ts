/**
 * Transactions Components
 *
 * Este barrel file exporta todos los componentes de transacciones.
 * Los componentes están organizados en archivos separados para mejor mantenibilidad.
 */

// Main list component
export { TransactionList, type TransactionListProps } from './transaction-list';

// Table components
export { TransactionTable, TransactionTableSkeleton, type TransactionTableProps } from './transaction-table';

// Pay Credit Card components
export { BulkPayCreditCardDialog, type BulkPayCreditCardDialogProps } from './bulk-pay-cc-dialog';

// Transaction Form
export { TransactionDialogContent, type TransactionDialogContentProps } from './transaction-form';

// Confirmation Dialogs
export {
  DeleteTransactionDialog,
  TogglePaidDialog,
  BulkDeleteDialog,
  HistoricallyPaidDialog,
} from './confirmation-dialogs';
