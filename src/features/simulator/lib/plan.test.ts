import { describe, expect, it } from 'vitest';
import { buildOptions, computePlan, loanCAE, loanCost, loanInstallment, loanPayment, matchFund, type SimulatorData } from './plan';

// Los datos de la conversación: maquinaria apartada, ahorros y la plata de la abuelita
const data: SimulatorData = {
  monthlySaving: 400_000,
  sources: [
    { id: 'maq', kind: 'fund', name: 'Maquinaria terreno', accountName: '#7343', available: 800_000 },
    { id: 'dental', kind: 'fund', name: 'Tratamiento dental Yoha', accountName: '#7343', available: 1_400_000 },
    { id: 'a1', kind: 'savings', name: 'Fondo Ahorro #1', accountName: 'Fondo Ahorro #1', available: 2_000_000 },
    { id: 'a2', kind: 'savings', name: 'Fondo Ahorro #2', accountName: 'Fondo Ahorro #2', available: 1_400_000 },
    { id: 'hue', kind: 'savings', name: 'Fondo Huevito', accountName: 'Fondo Huevito', available: 600_000 },
    { id: 'abu', kind: 'third_party', name: 'Ahorro Abuelita', accountName: 'Fondo Ahorro #2', available: 2_500_000 },
  ],
};

describe('préstamo', () => {
  it('cuota con sistema francés e interés total', () => {
    expect(loanInstallment(2_200_000, 24, 0.018)).toBe(113_698);
    expect(loanCost({ amount: 2_200_000, months: 24, monthlyRate: 0.018 })).toBe(113_698 * 24 - 2_200_000);
    expect(loanInstallment(1_200_000, 12, 0)).toBe(100_000);
    expect(loanInstallment(0, 12, 0.018)).toBe(0);
  });

  it('con la oferta del banco usa su cuota y suma los gastos iniciales al costo', () => {
    const offer = { amount: 2_200_000, months: 24, monthlyRate: 0, offerInstallment: 120_000, upfrontCosts: 30_000 };
    expect(loanPayment(offer)).toBe(120_000);
    expect(loanCost(offer)).toBe(120_000 * 24 + 30_000 - 2_200_000);
  });

  it('el modo estimado suma el seguro mensual a la cuota', () => {
    expect(loanPayment({ amount: 1_200_000, months: 12, monthlyRate: 0, monthlyInsurance: 2_000 })).toBe(102_000);
  });

  it('la CAE recupera la tasa y sube con los gastos', () => {
    const base = { amount: 2_200_000, months: 24, monthlyRate: 0.018 };
    expect(loanCAE(base)!).toBeCloseTo(1.018 ** 12 - 1, 2);
    expect(loanCAE({ ...base, upfrontCosts: 50_000 })!).toBeGreaterThan(loanCAE(base)!);
    expect(loanCAE({ ...base, monthlyRate: 0 })!).toBeCloseTo(0, 4);
  });
});

describe('matchFund', () => {
  it('encuentra el fondo apartado por nombre, sin tildes', () => {
    expect(matchFund('Máquinaria para el terreno', data.sources)?.id).toBe('maq');
    expect(matchFund('Mac Studio', data.sources)).toBeNull();
  });
});

describe('buildOptions', () => {
  it('parte por lo apartado y arma las 4 opciones', () => {
    const { earmarked, rest, options } = buildOptions('Maquinaria terreno', 3_000_000, data);
    expect(earmarked?.id).toBe('maq');
    expect(rest).toBe(2_200_000);
    const byId = Object.fromEntries(options.map((o) => [o.id, o]));

    expect(byId.savings).toMatchObject({ extraCost: 0, savingsAfter: 1_800_000, monthsToHave: 0, monthsToRecover: 6, viable: true, recommended: true });
    expect(byId.save_up).toMatchObject({ savingsAfter: 4_000_000, monthsToHave: 6 });
    expect(byId.bank).toMatchObject({ installment: 113_698, monthsToRecover: 24, savingsAfter: 4_000_000 });
    expect(byId.bank.extraCost).toBeGreaterThan(500_000);
    expect(byId.third_party).toMatchObject({ title: 'Préstamo de Abuelita', extraCost: 0, savingsAfter: 4_000_000, monthsToRecover: 6 });
    expect(byId.third_party.plan.allocations).toEqual({ maq: 800_000, abu: 2_200_000 });
    expect(byId.third_party.plan.earmarkedId).toBe('maq');
  });

  it('sin plata de terceros no ofrece esa opción; si los ahorros no alcanzan, no es viable', () => {
    const sinTerceros = { ...data, sources: data.sources.filter((s) => s.kind !== 'third_party') };
    const { options } = buildOptions('Viaje', 5_000_000, sinTerceros);
    expect(options.map((o) => o.id)).toEqual(['savings', 'save_up', 'bank']);
    expect(options[0].viable).toBe(false);
    expect(options.find((o) => o.recommended)?.id).toBe('save_up');
  });
});

describe('computePlan', () => {
  it('repone primero a terceros y después tus ahorros; los fondos no se reponen', () => {
    const r = computePlan(
      { target: 3_000_000, allocations: { maq: 800_000, abu: 1_100_000, a1: 1_100_000 }, bank: { amount: 0, months: 24, monthlyRate: 0.018 }, monthlyRepay: 400_000, earmarkedId: 'maq' },
      data.sources
    );
    expect(r).toMatchObject({ covered: 3_000_000, missing: 0, fromFunds: 800_000, fromThirdParty: 1_100_000, fromSavings: 1_100_000 });
    expect(r.thirdPartyDoneMonth).toBe(3); // 400 + 400 + 300
    expect(r.savingsDoneMonth).toBe(6); // 100 + 400 + 400 + 200
    expect(r.schedule[2]).toMatchObject({ toThirdParty: 300_000, toSavings: 100_000 });
  });

  it('la cuota del banco se paga primero con lo que destinas al mes', () => {
    const r = computePlan(
      { target: 2_000_000, allocations: { maq: 800_000, a1: 200_000 }, bank: { amount: 1_000_000, months: 12, monthlyRate: 0 }, monthlyRepay: 150_000, earmarkedId: 'maq' },
      data.sources
    );
    expect(r.installment).toBe(83_333);
    expect(r.schedule[0]).toMatchObject({ loanPayment: 83_333, toSavings: 66_667 });
    expect(r.savingsDoneMonth).toBe(3); // 200.000 a 66.667 al mes
    expect(r.loanDoneMonth).toBe(12);
    expect(r.installmentTooHigh).toBe(false);
  });

  it('avisa si falta plata, si la cuota no cabe, y no deja sacar más de lo disponible', () => {
    const r = computePlan(
      { target: 3_000_000, allocations: { maq: 5_000_000 }, bank: { amount: 1_000_000, months: 6, monthlyRate: 0.018 }, monthlyRepay: 100_000, earmarkedId: 'maq' },
      data.sources
    );
    expect(r.fromFunds).toBe(800_000);
    expect(r.missing).toBe(1_200_000);
    expect(r.installmentTooHigh).toBe(true);
  });

  it('usar un fondo que tenía otro destino se repone como ahorro', () => {
    const r = computePlan(
      { target: 1_000_000, allocations: { dental: 1_000_000 }, bank: { amount: 0, months: 12, monthlyRate: 0 }, monthlyRepay: 500_000, earmarkedId: 'maq' },
      data.sources
    );
    expect(r).toMatchObject({ fromFunds: 0, fromSavings: 1_000_000, savingsDoneMonth: 2 });
  });

  it('los meses de gracia corren la primera cuota', () => {
    const r = computePlan(
      { target: 1_000_000, allocations: {}, bank: { amount: 1_000_000, months: 10, monthlyRate: 0, graceMonths: 2 }, monthlyRepay: 200_000 },
      data.sources
    );
    expect(r.schedule.slice(0, 3).map((m) => m.loanPayment)).toEqual([0, 0, 100_000]);
    expect(r.loanDoneMonth).toBe(12);
  });

  it('sin nada que destinar, la reposición queda en "no alcanza"', () => {
    const r = computePlan({ target: 1_000_000, allocations: { a1: 1_000_000 }, bank: { amount: 0, months: 12, monthlyRate: 0 }, monthlyRepay: 0 }, data.sources);
    expect(r.savingsDoneMonth).toBe(-1);
  });
});
