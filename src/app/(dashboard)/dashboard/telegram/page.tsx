import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { getTelegramStatus } from '@/features/telegram/queries';
import { TelegramConnect } from '@/features/telegram/components/telegram-connect';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function TelegramPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) redirect('/dashboard');
    projectId = latestProject.id;
  }

  const [[project], status] = await Promise.all([
    db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1),
    getTelegramStatus(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Telegram</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Registra gastos escribiéndole a un bot, sin abrir la app.</p>
      </div>
      <TelegramConnect userId={session.user.id} projectId={projectId} projectName={project?.name ?? 'tu proyecto'} status={status} />
    </div>
  );
}
