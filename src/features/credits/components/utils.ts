/**
 * Calcula cuántas cuotas están vencidas basándose en la fecha de inicio,
 * frecuencia y la fecha actual (solo cuenta cuotas cuya fecha ya pasó)
 */
export function calculatePaidInstallments(
  startDate: Date | undefined,
  frequency: 'monthly' | 'biweekly' | 'weekly' | undefined,
  totalInstallments: number | undefined
): number {
  if (!startDate || !frequency || !totalInstallments) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(startDate);

  if (start >= today) return 0;

  let paidCount = 0;

  for (let i = 0; i < totalInstallments; i++) {
    const paymentDate = new Date(start);

    switch (frequency) {
      case 'monthly':
        paymentDate.setMonth(paymentDate.getMonth() + i);
        break;
      case 'biweekly':
        paymentDate.setDate(paymentDate.getDate() + i * 14);
        break;
      case 'weekly':
        paymentDate.setDate(paymentDate.getDate() + i * 7);
        break;
    }

    if (paymentDate < today) {
      paidCount++;
    } else {
      break;
    }
  }

  return paidCount;
}
