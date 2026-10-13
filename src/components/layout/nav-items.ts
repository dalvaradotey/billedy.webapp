import {
  Home,
  ArrowDownUp,
  Wallet,
  Target,
  PiggyBank,
  CreditCard,
  Receipt,
  FileText,
  CalendarClock,
  Tags,
  Send,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Destinos principales: van en la cápsula móvil y arriba en la barra lateral. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/dashboard/transactions', label: 'Movimientos', icon: ArrowDownUp },
  { href: '/dashboard/accounts', label: 'Cuentas', icon: Wallet },
];

/** El resto: en "Más" en móvil y visibles completos en desktop. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard/budgets', label: 'Presupuestos', icon: Target },
  { href: '/dashboard/saving-goals', label: 'Metas de ahorro', icon: PiggyBank },
  { href: '/dashboard/card-purchases', label: 'Compras en cuotas', icon: CreditCard },
  { href: '/dashboard/credits', label: 'Créditos', icon: Receipt },
  { href: '/dashboard/templates', label: 'Plantillas', icon: FileText },
  { href: '/dashboard/cycles', label: 'Ciclos', icon: CalendarClock },
  { href: '/dashboard/categories', label: 'Categorías', icon: Tags },
  { href: '/dashboard/telegram', label: 'Telegram', icon: Send },
];

export function isNavActive(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
}
