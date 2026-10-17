import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { parseAfcDocument } from './afc-documents';
import { expectedContributions, periodLabel } from './contributions';
import { fetchAfcQuotaValues, fetchAfpQuotaValues } from './quota-values';

const csvResponse = (text: string) =>
  ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(text).buffer }) as unknown as Response;

describe('valor cuota (CSV de la Superintendencia)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lee el valor cuota de cada AFP (no el patrimonio) y deja uno por día', async () => {
    const csv = [
      'Valores confirmados',
      'Fecha;CAPITAL;;MODELO;',
      ';Valor Cuota;Patrimonio;Valor Cuota;Patrimonio',
      '2026-10-14;70.000,10;999.999.999;77.000,50;888.888',
      'Valores disponibles',
      'Fecha;CAPITAL;;MODELO;',
      '2026-10-14;70.000,10;999.999.999;77.100,00;888.888',
      '2026-10-15;70.100,00;1;77.542,73;2',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse(csv)));

    const values = await fetchAfpQuotaValues(2026, 'C');
    const modelo = values.filter((v) => v.provider === 'MODELO').sort((a, b) => a.date.localeCompare(b.date));
    expect(modelo).toEqual([
      { provider: 'MODELO', fund: 'C', date: '2026-10-14', value: 77_100 },
      { provider: 'MODELO', fund: 'C', date: '2026-10-15', value: 77_542.73 },
    ]);
    expect(values.find((v) => v.provider === 'CAPITAL' && v.date === '2026-10-14')?.value).toBe(70_000.1);
  });

  it('falla con un formato desconocido o una respuesta con error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse('hola;mundo')));
    await expect(fetchAfpQuotaValues(2026, 'C')).rejects.toThrow(/formato/);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    await expect(fetchAfcQuotaValues(2026)).rejects.toThrow(/503/);
  });

  it('lee el fondo de cesantía', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse('Fecha;Valor\n2026-10-15;4.250,22\n2026-10-16;0')));
    expect(await fetchAfcQuotaValues(2026)).toEqual([{ provider: 'AFC', fund: 'CIC', date: '2026-10-15', value: 4250.22 }]);
  });
});

describe('expectedContributions', () => {
  const afp = { pensionProvider: 'MODELO', quotaCountDate: '2026-10-01' };

  it('espera una cotización por mes desde las cuotas configuradas', () => {
    const list = expectedContributions(afp, [], '2026-10-16');
    // Septiembre se paga entre el 12 y el 20 de octubre
    expect(list[0]).toMatchObject({ period: '2026-09-01', windowStart: '2026-10-12', windowEnd: '2026-10-20', status: 'due', amount: null });
    expect(list.at(-1)!.status).toBe('upcoming');
  });

  it('no repite las que ya llegaron y estima con el último monto', () => {
    const list = expectedContributions(afp, [{ period: '2026-09-01', amount: 410_000 }], '2026-10-16');
    expect(list.map((c) => c.period)).not.toContain('2026-09-01');
    expect(list.every((c) => c.amount === 410_000)).toBe(true);
  });

  it('marca atrasada la que pasó su ventana con 5 días de gracia', () => {
    const list = expectedContributions(afp, [], '2026-10-26');
    expect(list.find((c) => c.period === '2026-09-01')!.status).toBe('late');
  });

  it('usa la ventana de AFC (6 al 12) y nada sin cuotas configuradas', () => {
    const afc = expectedContributions({ pensionProvider: 'AFC', quotaCountDate: '2026-10-01' }, [], '2026-10-08');
    expect(afc[0]).toMatchObject({ windowStart: '2026-10-06', windowEnd: '2026-10-12' });
    expect(expectedContributions({ pensionProvider: null, quotaCountDate: null }, [], '2026-10-08')).toEqual([]);
  });

  it('periodLabel', () => {
    expect(periodLabel('2026-09-01')).toBe('septiembre 2026');
  });
});

describe('parseAfcDocument', () => {
  it('lee el certificado y une las líneas del afiliado y del empleador', () => {
    const doc = parseAfcDocument([
      'Certificado de cotizaciones previsionales Seguro de Cesantía',
      'Agosto 2026 76.123.456-7 NOMADES SPA $ 3.000.000 $ 18.000 11/09/2026',
      'Agosto 2026 76.123.456-7 NOMADES SPA $ 3.000.000 $ 72.000 11/09/2026',
      'Septiembre 2026 76.123.456-7 NOMADES SPA $ 3.100.000 $ 93.000 09/10/2026',
    ]);
    expect(doc).toEqual({
      kind: 'certificado',
      contributions: [
        { period: '2026-08-01', paidDate: '2026-09-11', taxableIncome: 3_000_000, amount: 90_000, quotas: null, employerRut: '76.123.456-7' },
        { period: '2026-09-01', paidDate: '2026-10-09', taxableIncome: 3_100_000, amount: 93_000, quotas: null, employerRut: '76.123.456-7' },
      ],
    });
  });

  it('lee la cartola con cuotas y el saldo al cierre', () => {
    const doc = parseAfcDocument([
      'Cartola de movimientos',
      '08-04-2026 10-04-2026 101-01 123 COT.AFIL. 03/2026 3.000.000 18.000 4,2500 X 76.123.456-7',
      '08-04-2026 10-04-2026 104-01 124 COT.EMP. 03/2026 3.000.000 72.000 17,0000 X 76.123.456-7',
      'Saldo de la cartola anterior al: 30-04-2026',
      'Saldo total: 2.258,38',
    ]);
    expect(doc).toEqual({
      kind: 'cartola',
      contributions: [
        { period: '2026-03-01', paidDate: '2026-04-10', taxableIncome: 3_000_000, amount: 90_000, quotas: 21.25, employerRut: '76.123.456-7' },
      ],
      closing: { date: '2026-04-30', quotas: 2258.38 },
    });
  });

  it('no reconoce otros documentos', () => {
    expect(parseAfcDocument(['Estado de cuenta tarjeta'])).toBeNull();
  });
});
