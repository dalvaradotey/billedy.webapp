import { describe, expect, it } from 'vitest';
import { autoCardDesignId, cardDesignFor, getCardDesign } from './card-designs';

type TestAccount = { name: string; type: string; bankName: null; entity: { name: string } | null; cardDesign: string | null };
const account = (name: string, type = 'checking', bank: string | null = null): TestAccount => ({
  name,
  type,
  bankName: null,
  entity: bank ? { name: bank } : null,
  cardDesign: null,
});
// Los helpers solo leen nombre, tipo, banco y diseño
const as = (a: TestAccount) => a as never;

describe('diseño de tarjeta', () => {
  it('elige el diseño según banco, nombre o tipo', () => {
    expect(autoCardDesignId(as(account('WorldMember VISA #1669', 'credit_card')))).toBe('worldmember-plumas');
    expect(autoCardDesignId(as(account('Corriente #6114', 'checking', 'Santander')))).toBe('santander-plumas');
    expect(autoCardDesignId(as(account('Cuenta RUT')))).toBe('bancoestado');
    expect(autoCardDesignId(as(account('Fondo de Cesantía', 'unemployment')))).toBe('afc');
    expect(autoCardDesignId(as(account('Fondo de Retiro', 'pension')))).toBe('afp-modelo');
  });

  it('sin banco conocido usa un diseño liso estable', () => {
    const id = autoCardDesignId(as(account('Fondo Huevito', 'savings')));
    expect(id).toBe(autoCardDesignId(as(account('Fondo Huevito', 'savings'))));
    expect(getCardDesign(id)?.kind).toBe('plain');
  });

  it('respeta el diseño elegido y cae al automático si no existe', () => {
    expect(cardDesignFor(as({ ...account('Cuenta RUT'), cardDesign: 'fintual' })).id).toBe('fintual');
    expect(cardDesignFor(as({ ...account('Cuenta RUT'), cardDesign: 'no-existe' })).id).toBe('bancoestado');
    expect(getCardDesign(null)).toBeUndefined();
  });
});
