/**
 * Registra el webhook del bot y su lista de comandos.
 *
 *   npx tsx scripts/telegram-setup.ts https://tu-dominio.vercel.app
 *
 * Lee TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET del .env (los mismos que en Vercel).
 * Sin URL, solo muestra el estado actual del webhook.
 */
import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !secret) {
  console.error('Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en el .env');
  process.exit(1);
}

async function call(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

const base = process.argv[2]?.replace(/\/$/, '');

const me = await call('getMe');
console.log(`Bot: @${me.username}`);

if (base) {
  const url = `${base}/api/telegram/webhook`;
  await call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  await call('setMyCommands', {
    commands: [
      { command: 'techo', description: 'Disponible en la tarjeta' },
      { command: 'hoy', description: 'Lo registrado hoy' },
      { command: 'deshacer', description: 'Borra el último guardado' },
      { command: 'ayuda', description: 'Cómo escribir un gasto' },
    ],
  });
  console.log(`✅ Webhook: ${url}`);
}

const info = await call('getWebhookInfo');
console.log({
  url: info.url || '(sin webhook)',
  pendientes: info.pending_update_count,
  ultimoError: info.last_error_message ?? null,
});
