/**
 * Crea en la app una simulación "Propuesto por Claude" desde un JSON:
 *   { "projectId": "...", "name": "...", "target": 3000000, "note": "por qué", "plan": PlanInput }
 *
 *   npx tsx scripts/simulation-propose.ts propuesta.json           → solo muestra el resultado
 *   npx tsx scripts/simulation-propose.ts propuesta.json --apply   → la guarda (escribe en la BD)
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectMembers, simulations } from '@/lib/db/schema';
import { getSimulatorData } from '@/features/simulator/queries';
import { computePlan, type PlanInput } from '@/features/simulator/lib/plan';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error('Falta el archivo JSON');
  const input = JSON.parse(readFileSync(file, 'utf8')) as { projectId: string; name: string; target: number; note: string; plan: PlanInput };
  const [owner] = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, input.projectId)).limit(1);
  const data = await getSimulatorData(input.projectId, owner.userId);
  if (!data) throw new Error('Proyecto no encontrado');

  const r = computePlan({ ...input.plan, target: input.target }, data.sources);
  console.log(`${input.name} · ${fmt(input.target)} · cubre ${fmt(r.covered)} · falta ${fmt(r.missing)} · extra ${fmt(r.extraCost)}`);
  console.log(`terceros listo mes ${r.thirdPartyDoneMonth} · ahorros listo mes ${r.savingsDoneMonth} · banco termina mes ${r.loanDoneMonth}`);
  if (r.missing !== 0) throw new Error('El plan no suma el monto exacto');

  if (flag !== '--apply') return console.log('\n(solo vista previa: agrega --apply para guardarla)');
  const [row] = await db
    .insert(simulations)
    .values({ projectId: input.projectId, userId: null, name: input.name, target: String(input.target), plan: input.plan, source: 'claude', note: input.note })
    .returning({ id: simulations.id });
  console.log(`✅ Guardada: ${row.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
