/**
 * Lee las simulaciones "¿Me alcanza?" guardadas y las recalcula con los datos
 * actuales (solo lectura). Lo usa Claude para revisarlas y proponer otras.
 *
 *   npx tsx scripts/simulation-read.ts            → las últimas 5
 *   npx tsx scripts/simulation-read.ts maquinaria → las que contienen ese nombre
 */
import 'dotenv/config';
import { desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectMembers, simulations } from '@/lib/db/schema';
import { getSimulatorData } from '@/features/simulator/queries';
import { buildOptions, computePlan, type PlanInput } from '@/features/simulator/lib/plan';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

async function main() {
  const filter = process.argv[2];
  const rows = await db
    .select()
    .from(simulations)
    .where(filter ? ilike(simulations.name, `%${filter}%`) : undefined)
    .orderBy(desc(simulations.createdAt))
    .limit(5);
  if (!rows.length) return console.log('No hay simulaciones guardadas.');

  // Un solo proyecto por ahora: los datos actuales se leen una vez
  const projectId = rows[0].projectId;
  const [owner] = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, projectId)).limit(1);
  const data = await getSimulatorData(projectId, owner.userId);
  if (!data) return console.log('Proyecto no encontrado.');

  for (const sim of rows.filter((r) => r.projectId === projectId)) {
    const plan = sim.plan as PlanInput;
    const r = computePlan({ ...plan, target: Number(sim.target) }, data.sources);
    const names = new Map(data.sources.map((s) => [s.id, `${s.name} (${s.kind})`]));

    console.log(`\n── ${sim.name} · ${fmt(Number(sim.target))} · ${sim.source} · ${sim.id}`);
    if (sim.note) console.log(`   nota: ${sim.note}`);
    for (const [id, amount] of Object.entries(plan.allocations)) {
      if (amount > 0) console.log(`   ${names.get(id) ?? `${id} (ya no existe)`}: ${fmt(amount)}`);
    }
    if (r.advance.amount > 0) console.log(`   avance: ${fmt(r.advance.amount)} · cuota ${fmt(r.advance.installment)} · extra ${fmt(r.advance.extraCost)} · CAE ${r.advance.cae != null ? (r.advance.cae * 100).toFixed(1) + '%' : '-'}`);
    if (r.loanAmount > 0) console.log(`   banco: ${fmt(r.loanAmount)} · cuota ${fmt(r.installment)} · extra ${fmt(r.extraCost)} · CAE ${r.cae != null ? (r.cae * 100).toFixed(1) + '%' : '-'}`);
    console.log(`   destina ${fmt(plan.monthlyRepay)}/mes · falta ${fmt(r.missing)} · terceros listo mes ${r.thirdPartyDoneMonth} · ahorros listo mes ${r.savingsDoneMonth} · banco termina mes ${r.loanDoneMonth}`);
    const { options } = buildOptions(sim.name, Number(sim.target), data);
    console.log(`   opciones de la app: ${options.map((o) => `${o.id}${o.recommended ? '*' : ''} extra ${fmt(o.extraCost)}`).join(' · ')}`);
  }
  console.log(`\nAhorro mensual del plan: ${fmt(data.monthlySaving)} · fuentes actuales (projectId ${projectId}):`);
  for (const s of data.sources) console.log(`   ${s.id} · ${s.kind} · ${s.name} (${s.accountName}): ${fmt(s.available)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
