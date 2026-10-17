import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getTelegramStatus } from '@/features/telegram/queries';
import { TelegramConnect } from '@/features/telegram/components/telegram-connect';

export default async function TelegramPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const cookieProjectId = await getCurrentProjectId();

  // getProjectById solo devuelve el proyecto si el usuario es miembro aceptado:
  // una cookie con un proyecto ajeno no debe mostrar su nombre ni vincularse
  const [cookieProject, status] = await Promise.all([
    cookieProjectId ? getProjectById(cookieProjectId, session.user.id) : null,
    getTelegramStatus(session.user.id),
  ]);

  const project = cookieProject ?? (await getLatestProject(session.user.id));
  if (!project) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Telegram</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Registra gastos escribiéndole a un bot, sin abrir la app.</p>
      </div>
      <TelegramConnect userId={session.user.id} projectId={project.id} projectName={project.name} status={status} />
    </div>
  );
}
