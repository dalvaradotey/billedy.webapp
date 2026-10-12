/**
 * Aplica las migraciones SQL de src/lib/db/manual-migrations que aún no están
 * registradas en n1n4_schema_migrations. Cada archivo corre en su propia transacción.
 *
 * El journal de drizzle-kit quedó desincronizado con la BD (columnas aplicadas
 * sin migración), así que los cambios nuevos se versionan como SQL manual.
 *
 *   npx tsx scripts/db-migrate.ts            → muestra las pendientes (no aplica nada)
 *   npx tsx scripts/db-migrate.ts --apply    → las aplica
 */
import 'dotenv/config';
import postgres from 'postgres';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), 'src/lib/db/manual-migrations');

async function main() {
  const apply = process.argv.includes('--apply');
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  try {
    if (apply) {
      await client`
        create table if not exists n1n4_schema_migrations (
          name varchar(255) primary key,
          applied_at timestamp not null default now()
        )`;
    }
    const [{ exists }] = await client<{ exists: boolean }[]>`
      select to_regclass('public.n1n4_schema_migrations') is not null as exists`;
    const applied = new Set(
      exists
        ? (await client<{ name: string }[]>`select name from n1n4_schema_migrations`).map((r) => r.name)
        : []
    );
    const pending = readdirSync(DIR)
      .filter((f) => f.endsWith('.sql') && !applied.has(f))
      .sort();

    if (pending.length === 0) {
      console.log('No hay migraciones pendientes.');
      return;
    }

    for (const file of pending) {
      if (!apply) {
        console.log(`Pendiente: ${file}`);
        continue;
      }
      const sqlText = readFileSync(join(DIR, file), 'utf-8');
      await client.begin(async (transaction) => {
        const tx = transaction as unknown as postgres.Sql;
        await tx.unsafe(sqlText);
        await tx`insert into n1n4_schema_migrations (name) values (${file})`;
      });
      console.log(`✅ Aplicada: ${file}`);
    }

    if (!apply) console.log('\nCorre con --apply para aplicarlas.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
