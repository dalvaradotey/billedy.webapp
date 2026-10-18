/**
 * Simulador "¿Me alcanza?": cómo juntar un monto y cómo reponerlo.
 *
 * Todo es cálculo puro sobre lo que ya hay en la app:
 * - fondos apartados (uno con un nombre parecido al gasto se usa primero);
 * - ahorros propios (sin la plata de terceros que guardan);
 * - plata de terceros, como préstamo sin interés;
 * - un préstamo del banco (cuota con sistema francés);
 * - lo que ahorras al mes (meta de ahorro del plan), para juntar o reponer.
 */

export type SourceKind = 'fund' | 'savings' | 'third_party';

export type Source = {
  id: string;
  kind: SourceKind;
  name: string;
  /** Cuenta donde está (para mostrar) */
  accountName: string;
  available: number;
};

export type SimulatorData = {
  sources: Source[];
  /** Lo que ahorras al mes según tu plan */
  monthlySaving: number;
};

export type BankLoan = {
  amount: number;
  months: number;
  /** Tasa mensual (modo estimado) */
  monthlyRate: number;
  /** Cuota que te ofreció el banco: si está, manda sobre la tasa */
  offerInstallment?: number | null;
  /** Seguros u otros cargos que se suman cada mes a la cuota (modo estimado) */
  monthlyInsurance?: number;
  /** Gastos al inicio: impuesto de timbres, notaría, comisión */
  upfrontCosts?: number;
  /** Meses antes de la primera cuota */
  graceMonths?: number;
};

export type PlanInput = {
  target: number;
  /** Monto que se saca de cada fuente (id → monto) */
  allocations: Record<string, number>;
  bank: BankLoan;
  /** Cuánto destinas al mes a reponer (por defecto, tu ahorro mensual) */
  monthlyRepay: number;
  /** Fondo apartado para este gasto: lo que sale de él no se repone */
  earmarkedId?: string | null;
};

export const DEFAULT_MONTHLY_RATE = 0.018;
export const DEFAULT_LOAN_MONTHS = 24;

/** Cuota mensual de un préstamo (sistema francés) */
export function loanInstallment(amount: number, months: number, monthlyRate: number): number {
  if (amount <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return Math.round(amount / months);
  return Math.round((amount * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

/** Lo que pagas cada mes: la cuota ofrecida o la estimada con su seguro */
export function loanPayment(loan: BankLoan): number {
  if (loan.amount <= 0 || loan.months <= 0) return 0;
  if (loan.offerInstallment && loan.offerInstallment > 0) return Math.round(loan.offerInstallment);
  return loanInstallment(loan.amount, loan.months, loan.monthlyRate) + Math.round(loan.monthlyInsurance ?? 0);
}

/** Lo que pagas además del monto: intereses, seguros y gastos iniciales */
export function loanCost(loan: BankLoan): number {
  if (loan.amount <= 0) return 0;
  return Math.max(0, loanPayment(loan) * loan.months + (loan.upfrontCosts ?? 0) - loan.amount);
}

/**
 * CAE (carga anual equivalente): la tasa anual que iguala lo que recibes
 * (monto − gastos iniciales) con las cuotas que pagas. Incluye todos los costos.
 */
export function loanCAE(loan: BankLoan): number | null {
  const payment = loanPayment(loan);
  const received = loan.amount - (loan.upfrontCosts ?? 0);
  if (payment <= 0 || received <= 0) return null;
  const grace = loan.graceMonths ?? 0;
  const presentValue = (r: number) => {
    let pv = 0;
    for (let t = grace + 1; t <= grace + loan.months; t++) pv += payment / (1 + r) ** t;
    return pv;
  };
  if (presentValue(0) <= received) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (presentValue(mid) > received) lo = mid;
    else hi = mid;
  }
  return (1 + lo) ** 12 - 1;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

/** Fondo apartado para este gasto: el que comparte una palabra con el nombre */
export function matchFund(name: string, sources: Source[]): Source | null {
  const target = new Set(words(name));
  if (!target.size) return null;
  return sources.find((s) => s.kind === 'fund' && s.available > 0 && words(s.name).some((w) => target.has(w))) ?? null;
}

const sum = (list: Source[]) => list.reduce((acc, s) => acc + s.available, 0);

/** Reparte un monto entre fuentes, de la que más tiene a la que menos */
function takeFrom(list: Source[], amount: number): Record<string, number> {
  const result: Record<string, number> = {};
  let rest = amount;
  for (const s of [...list].sort((a, b) => b.available - a.available)) {
    if (rest <= 0) break;
    const take = Math.min(s.available, rest);
    if (take > 0) result[s.id] = take;
    rest -= take;
  }
  return result;
}

export type OptionId = 'savings' | 'save_up' | 'bank' | 'third_party';

export type PlanOption = {
  id: OptionId;
  title: string;
  /** Una línea: qué haces */
  summary: string;
  /** Lo que pagas además del monto */
  extraCost: number;
  /** Tus ahorros propios después de sacar la plata */
  savingsAfter: number;
  /** La opción saca plata de tus ahorros */
  touchesSavings: boolean;
  /** Meses hasta tener la plata (0 = ya) */
  monthsToHave: number;
  /** Meses hasta reponer todo (ahorros o deuda) */
  monthsToRecover: number;
  /** Cuota mensual si hay préstamo */
  installment: number;
  viable: boolean;
  recommended: boolean;
  /** Plan listo para ajustar en "Armar mi plan" */
  plan: PlanInput;
};

/**
 * Las 4 maneras de juntar el monto, partiendo por lo ya apartado para este gasto.
 */
export function buildOptions(name: string, target: number, data: SimulatorData): { earmarked: Source | null; rest: number; options: PlanOption[] } {
  const earmarked = matchFund(name, data.sources);
  const pre = Math.min(earmarked?.available ?? 0, target);
  const rest = Math.max(0, target - pre);
  const base: Record<string, number> = earmarked && pre > 0 ? { [earmarked.id]: pre } : {};
  const savings = data.sources.filter((s) => s.kind === 'savings');
  const thirdParty = data.sources.filter((s) => s.kind === 'third_party');
  const totalSavings = sum(savings);
  const totalThirdParty = sum(thirdParty);
  const saving = Math.max(0, data.monthlySaving);
  const monthsFor = (amount: number) => (amount <= 0 ? 0 : saving > 0 ? Math.ceil(amount / saving) : Infinity);
  const noLoan: BankLoan = { amount: 0, months: DEFAULT_LOAN_MONTHS, monthlyRate: DEFAULT_MONTHLY_RATE };
  const plan = (allocations: Record<string, number>, bank: BankLoan = noLoan): PlanInput => ({
    target,
    allocations: { ...base, ...allocations },
    bank,
    monthlyRepay: saving,
    earmarkedId: earmarked && pre > 0 ? earmarked.id : null,
  });

  const loan: BankLoan = { amount: rest, months: DEFAULT_LOAN_MONTHS, monthlyRate: DEFAULT_MONTHLY_RATE };
  const installment = loanPayment(loan);

  const options: PlanOption[] = [
    {
      id: 'savings',
      title: 'Usar tus ahorros',
      summary: 'Sacas lo que falta de tus ahorros y lo haces ya.',
      extraCost: 0,
      savingsAfter: totalSavings - rest,
      touchesSavings: rest > 0,
      monthsToHave: 0,
      monthsToRecover: monthsFor(rest),
      installment: 0,
      viable: totalSavings >= rest,
      recommended: false,
      plan: plan(takeFrom(savings, rest)),
    },
    {
      id: 'save_up',
      title: 'Juntar mes a mes',
      summary: 'Guardas lo que ahorras cada mes, sin tocar tus ahorros.',
      extraCost: 0,
      savingsAfter: totalSavings,
      touchesSavings: false,
      monthsToHave: monthsFor(rest),
      monthsToRecover: 0,
      installment: 0,
      viable: saving > 0,
      recommended: false,
      plan: plan({}),
    },
    {
      id: 'bank',
      title: 'Pedir un préstamo',
      summary: 'El banco te presta lo que falta y lo devuelves en cuotas.',
      extraCost: loanCost(loan),
      savingsAfter: totalSavings,
      touchesSavings: false,
      monthsToHave: 0,
      monthsToRecover: loan.months,
      installment,
      viable: rest > 0,
      recommended: false,
      plan: plan({}, loan),
    },
  ];

  if (totalThirdParty > 0) {
    const borrowed = Math.min(rest, totalThirdParty);
    const fromSavings = rest - borrowed;
    options.push({
      id: 'third_party',
      title: `Préstamo de ${thirdParty[0].name.replace(/^ahorro\s+/i, '') || 'terceros'}`,
      summary: 'Usas su plata sin interés y se la devuelves mes a mes.',
      extraCost: 0,
      savingsAfter: totalSavings - fromSavings,
      touchesSavings: fromSavings > 0,
      monthsToHave: 0,
      monthsToRecover: monthsFor(rest),
      installment: 0,
      viable: borrowed + Math.min(fromSavings, totalSavings) >= rest,
      recommended: false,
      plan: plan({ ...takeFrom(thirdParty, borrowed), ...takeFrom(savings, fromSavings) }),
    });
  }

  // Recomendada: la que no cuesta nada y la tienes ya, con tu propia plata; si no, la más barata
  const best =
    options.find((o) => o.id === 'savings' && o.viable && rest > 0) ??
    options.filter((o) => o.viable).sort((a, b) => a.extraCost - b.extraCost || a.monthsToHave - b.monthsToHave)[0];
  if (best) best.recommended = true;

  return { earmarked: earmarked && pre > 0 ? earmarked : null, rest, options };
}

export type ScheduleMonth = {
  /** 1 = el próximo mes */
  month: number;
  /** Cuota del banco pagada este mes */
  loanPayment: number;
  /** Devuelto a terceros este mes */
  toThirdParty: number;
  /** Repuesto a tus ahorros este mes */
  toSavings: number;
  /** Lo que queda por devolver a terceros y reponer en ahorros al final del mes */
  thirdPartyLeft: number;
  savingsLeft: number;
};

export type PlanResult = {
  covered: number;
  /** Falta (+) o sobra (−) para llegar al monto */
  missing: number;
  fromFunds: number;
  fromSavings: number;
  fromThirdParty: number;
  loanAmount: number;
  installment: number;
  extraCost: number;
  /** CAE del préstamo (con todos sus costos), si hay préstamo */
  cae: number | null;
  /** La cuota del banco no cabe en lo que destinas al mes */
  installmentTooHigh: boolean;
  schedule: ScheduleMonth[];
  /** Mes en que terminas de devolver a terceros / reponer ahorros / pagar el banco (0 = no aplica, −1 = no alcanza) */
  thirdPartyDoneMonth: number;
  savingsDoneMonth: number;
  loanDoneMonth: number;
};

const MAX_MONTHS = 120;

/**
 * Lo que sale de cada fuente y el calendario para reponerlo: cada mes, lo que
 * destinas paga primero la cuota del banco, luego devuelve a terceros y al final
 * repone tus ahorros (y otros fondos que hayas usado). Lo sacado del fondo apartado
 * para este gasto no se repone: era para esto.
 */
export function computePlan(input: PlanInput, sources: Source[]): PlanResult {
  const byId = new Map(sources.map((s) => [s.id, s]));
  let fromFunds = 0;
  let fromSavings = 0;
  let fromThirdParty = 0;
  for (const [id, raw] of Object.entries(input.allocations)) {
    const source = byId.get(id);
    const amount = Math.max(0, Math.min(raw || 0, source?.available ?? 0));
    if (!source || amount === 0) continue;
    // Solo el fondo apartado para este gasto queda usado; otro fondo tenía otro destino y se repone
    if (source.kind === 'fund' && source.id === input.earmarkedId) fromFunds += amount;
    else if (source.kind === 'fund' || source.kind === 'savings') fromSavings += amount;
    else fromThirdParty += amount;
  }
  const loanAmount = Math.max(0, input.bank.amount || 0);
  const loan = { ...input.bank, amount: loanAmount };
  const installment = loanPayment(loan);
  const grace = loanAmount > 0 ? Math.max(0, input.bank.graceMonths ?? 0) : 0;
  const covered = fromFunds + fromSavings + fromThirdParty + loanAmount;
  const repay = Math.max(0, input.monthlyRepay || 0);

  const schedule: ScheduleMonth[] = [];
  let thirdPartyLeft = fromThirdParty;
  let savingsLeft = fromSavings;
  let thirdPartyDoneMonth = fromThirdParty > 0 ? -1 : 0;
  let savingsDoneMonth = fromSavings > 0 ? -1 : 0;
  // Las cuotas van entre el mes grace + 1 y grace + plazo
  const loanMonths = loanAmount > 0 ? grace + input.bank.months : 0;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const payment = month > grace && month <= loanMonths ? installment : 0;
    if (month > loanMonths && thirdPartyLeft <= 0 && savingsLeft <= 0) break;
    let budget = Math.max(0, repay - payment);
    const toThirdParty = Math.min(thirdPartyLeft, budget);
    budget -= toThirdParty;
    thirdPartyLeft -= toThirdParty;
    const toSavings = Math.min(savingsLeft, budget);
    savingsLeft -= toSavings;
    if (thirdPartyDoneMonth === -1 && thirdPartyLeft <= 0) thirdPartyDoneMonth = month;
    if (savingsDoneMonth === -1 && savingsLeft <= 0) savingsDoneMonth = month;
    schedule.push({ month, loanPayment: payment, toThirdParty, toSavings, thirdPartyLeft, savingsLeft });
    // Sin nada que destinar, lo pendiente no avanza: se corta (queda "no alcanza")
    if (repay === 0 && month >= loanMonths) break;
  }

  return {
    covered,
    missing: input.target - covered,
    fromFunds,
    fromSavings,
    fromThirdParty,
    loanAmount,
    installment,
    extraCost: loanCost(loan),
    cae: loanAmount > 0 ? loanCAE(loan) : null,
    installmentTooHigh: installment > repay && loanAmount > 0,
    schedule,
    thirdPartyDoneMonth,
    savingsDoneMonth,
    loanDoneMonth: loanMonths,
  };
}
