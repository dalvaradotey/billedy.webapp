/**
 * Respaldo de todas las tablas n1n4_* a JSON (solo lectura).
 * Se usa antes de migraciones o limpiezas de datos.
 *
 *   npx tsx scripts/backup-tables.ts            → backups/<fecha-hora>/<tabla>.json
 */
import 'dotenv/config';
import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(process.cwd(), 'backups', stamp);
  mkdirSync(dir, { recursive: true });

  try {
    await client.begin('read only', async (transaction) => {
      const tx = transaction as unknown as postgres.Sql;
      const tables = await tx<{ tablename: string }[]>`
        select tablename from pg_tables where schemaname = 'public' and tablename like 'n1n4\\_%'
        order by tablename`;
      for (const { tablename } of tables) {
        const rows = await tx.unsafe(`select * from "${tablename}"`);
        writeFileSync(join(dir, `${tablename}.json`), JSON.stringify(rows, null, 2));
        console.log(`${tablename.padEnd(30)} ${rows.length} filas`);
      }
    });
  } finally {
    await client.end();
  }
  console.log(`\nRespaldo en ${dir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
