/**
 * Cliente mínimo de la Bot API de Telegram (solo lo que usa el bot).
 */

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = InlineButton[][];

export type TelegramUpdate = {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; text?: string; from?: { first_name?: string } };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    // "message is not modified" no es un error real (se tocó dos veces el mismo botón)
    if (json.description?.includes('message is not modified')) return null;
    console.error(`[telegram] ${method}: ${json.description}`);
    return null;
  }
  return json.result ?? null;
}

const keyboard = (k?: InlineKeyboard) => (k ? { reply_markup: { inline_keyboard: k } } : {});

export function sendMessage(chatId: number, text: string, k?: InlineKeyboard) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...keyboard(k) });
}

export function editMessage(chatId: number, messageId: number, text: string, k?: InlineKeyboard) {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...(k ? keyboard(k) : { reply_markup: { inline_keyboard: [] } }),
  });
}

export function answerCallback(callbackId: string, text?: string) {
  return call('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

/** Escapa texto del usuario para parse_mode HTML */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
