import 'dotenv/config';
import { db } from './index';
import { currencies, categoryTemplates } from './schema';

async function seed() {
  console.log('🌱 Iniciando seed...');

  // ============================================================================
  // CURRENCIES
  // ============================================================================
  console.log('💰 Insertando currencies...');

  const currenciesData = [
    {
      code: 'CLP',
      symbol: '$',
      name: 'Peso Chileno',
      decimalSeparator: ',',
      thousandsSeparator: '.',
      decimalPlaces: 0,
    },
    {
      code: 'USD',
      symbol: 'US$',
      name: 'Dólar Estadounidense',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
    },
    {
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
      decimalSeparator: ',',
      thousandsSeparator: '.',
      decimalPlaces: 2,
    },
  ];

  await db
    .insert(currencies)
    .values(currenciesData)
    .onConflictDoNothing({ target: currencies.code });

  console.log(`✅ ${currenciesData.length} currencies insertadas`);

  // ============================================================================
  // CATEGORY TEMPLATES
  // ============================================================================
  console.log('📂 Insertando category templates...');

  const categoryTemplatesData = [
    // Gastos - Prioritarios
    { name: 'CAE', type: 'expense' as const, group: 'Prioritarios', color: '#ef4444' },
    { name: 'Agua', type: 'expense' as const, group: 'Prioritarios', color: '#3b82f6' },
    { name: 'Luz', type: 'expense' as const, group: 'Prioritarios', color: '#eab308' },
    { name: 'Gas', type: 'expense' as const, group: 'Prioritarios', color: '#f97316' },
    { name: 'Internet', type: 'expense' as const, group: 'Prioritarios', color: '#8b5cf6' },

    // Gastos - Suscripciones
    { name: 'Netflix', type: 'expense' as const, group: 'Suscripciones', color: '#dc2626' },
    { name: 'Spotify', type: 'expense' as const, group: 'Suscripciones', color: '#22c55e' },
    { name: 'Prime Video', type: 'expense' as const, group: 'Suscripciones', color: '#0ea5e9' },
    { name: 'Disney+', type: 'expense' as const, group: 'Suscripciones', color: '#1d4ed8' },
    { name: 'YouTube Premium', type: 'expense' as const, group: 'Suscripciones', color: '#dc2626' },

    // Gastos - Presupuestos
    { name: 'Comida', type: 'expense' as const, group: 'Presupuestos', color: '#84cc16' },
    { name: 'Bencina', type: 'expense' as const, group: 'Presupuestos', color: '#64748b' },
    { name: 'Veterinario', type: 'expense' as const, group: 'Presupuestos', color: '#ec4899' },
    { name: 'Pellets', type: 'expense' as const, group: 'Presupuestos', color: '#a16207' },
    { name: 'Transporte', type: 'expense' as const, group: 'Presupuestos', color: '#0891b2' },

    // Gastos - Otros
    { name: 'Github', type: 'expense' as const, group: 'Otros', color: '#171717' },
    { name: 'Seguros', type: 'expense' as const, group: 'Otros', color: '#0891b2' },
    { name: 'UNICEF', type: 'expense' as const, group: 'Otros', color: '#0ea5e9' },
    { name: 'Salud', type: 'expense' as const, group: 'Otros', color: '#10b981' },
    { name: 'Educación', type: 'expense' as const, group: 'Otros', color: '#6366f1' },
    { name: 'Entretenimiento', type: 'expense' as const, group: 'Otros', color: '#f472b6' },
    { name: 'Ropa', type: 'expense' as const, group: 'Otros', color: '#a855f7' },
    { name: 'Hogar', type: 'expense' as const, group: 'Otros', color: '#14b8a6' },

    // Ingresos
    { name: 'Sueldo', type: 'income' as const, group: null, color: '#22c55e' },
    { name: 'Bono', type: 'income' as const, group: null, color: '#10b981' },
    { name: 'Venta', type: 'income' as const, group: null, color: '#14b8a6' },
    { name: 'Freelance', type: 'income' as const, group: null, color: '#06b6d4' },
    { name: 'Inversiones', type: 'income' as const, group: null, color: '#8b5cf6' },
    { name: 'Reembolso', type: 'income' as const, group: null, color: '#f59e0b' },
    { name: 'Otros Ingresos', type: 'income' as const, group: null, color: '#6b7280' },
  ];

  await db.insert(categoryTemplates).values(categoryTemplatesData);

  console.log(`✅ ${categoryTemplatesData.length} category templates insertadas`);

  console.log('🎉 Seed completado!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Error en seed:', error);
  process.exit(1);
});
