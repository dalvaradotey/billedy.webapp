'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createTelegramLinkCode, unlinkTelegram } from '../actions';
import type { TelegramStatus } from '../queries';

interface TelegramConnectProps {
  userId: string;
  projectId: string;
  projectName: string;
  status: TelegramStatus;
}

const EXAMPLES = ['15990 lider compras casa', '8.500 copec movilización débito', '12 lucas almuerzo ayer', '+150000 aporte anais'];

/** Conectar el chat de Telegram con un código de un solo uso. */
export function TelegramConnect({ userId, projectId, projectName, status }: TelegramConnectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () =>
    startTransition(async () => {
      const result = await createTelegramLinkCode(userId, projectId);
      if (result.success) setCode(result.data.code);
      else toast.error(result.error);
    });

  const unlink = () =>
    startTransition(async () => {
      const result = await unlinkTelegram(userId);
      if (result.success) {
        toast.success('Telegram desconectado');
        router.refresh();
      } else toast.error(result.error);
    });

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/start ${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles: el código igual queda visible
    }
  };

  const botLink = status.botUsername && code ? `https://t.me/${status.botUsername}?start=${code}` : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-line bg-surface p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-soft text-sky">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">
              {status.linked ? 'Conectado' : 'Sin conectar'}
              {status.botUsername && <span className="font-semibold text-muted-foreground"> · @{status.botUsername}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {status.linked
                ? `Lo que le escribas al bot se guarda en ${status.projectName ?? projectName}, a tu nombre.`
                : `Conecta tu chat para registrar gastos en ${projectName} escribiéndole al bot.`}
            </p>
          </div>
        </div>

        {code ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Envíale esto al bot (vence en 15 minutos):</p>
            <div className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3">
              <code className="num flex-1 text-lg font-extrabold tracking-wider">/start {code}</code>
              <button
                type="button"
                onClick={copy}
                aria-label="Copiar"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-4 w-4 text-jade" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {botLink && (
              <Button asChild variant="cta" className="w-full">
                <a href={botLink} target="_blank" rel="noreferrer">
                  <Send className="h-4 w-4" />
                  Abrir el bot en Telegram
                </a>
              </Button>
            )}
            <button type="button" onClick={() => router.refresh()} className="min-h-10 w-full text-xs font-bold text-jade">
              Ya lo envié
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            <Button variant={status.linked ? 'outline' : 'cta'} disabled={isPending} onClick={generate} className="w-full">
              {status.linked ? 'Conectar otro chat' : 'Conectar Telegram'}
            </Button>
            {status.linked && (
              <Button variant="ghost" disabled={isPending} onClick={unlink} className="w-full text-coral-text">
                Desconectar
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-4 md:p-5">
        <p className="text-sm font-extrabold">Cómo escribirle</p>
        <p className="mt-1 text-xs text-muted-foreground">
          El monto y lo demás en cualquier orden. Reconoce tus tiendas, presupuestos (también por iniciales) y cuentas
          (débito, tc, santander). Antes de guardar te pide confirmar.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <li key={e} className="rounded-full bg-background px-3 py-1.5 font-mono text-xs text-[#CFC6D6]">
              {e}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Comandos: /techo (disponible en la tarjeta), /hoy (lo de hoy), /deshacer (el último guardado).
        </p>
      </section>
    </div>
  );
}
