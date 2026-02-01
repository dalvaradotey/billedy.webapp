import 'dotenv/config';
import { db } from './index';
import { currencies } from './schema';

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

  console.log('🎉 Seed completado!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Error en seed:', error);
  process.exit(1);
});
