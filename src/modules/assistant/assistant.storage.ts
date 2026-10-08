import 'server-only';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises';
import type { Conversation } from './assistant.types';

export const assistantDataRoot = () => process.env.SHOPAPP_ASSISTANT_DATA_DIR || path.resolve(process.cwd(), '.runtime', 'assistant');
const userRoot = (userId: string) => path.join(assistantDataRoot(), 'conversations', createHash('sha256').update(userId).digest('hex'));
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export async function getConversation(userId: string, id: string): Promise<Conversation> {
  if (!validId(id)) throw new Error('Conversation not found.');
  try { return JSON.parse(await readFile(path.join(userRoot(userId), `${id}.json`), 'utf8')); }
  catch { throw new Error('Conversation not found.'); }
}
export function newConversation(message: string): Conversation {
  return { id: randomUUID(), title: message.slice(0, 65), updatedAt: new Date().toISOString(), messages: [], turns: [] };
}
export async function saveConversation(userId: string, conversation: Conversation) {
  const root = userRoot(userId);
  await mkdir(root, { recursive: true });
  const target = path.join(root, `${conversation.id}.json`);
  const temp = `${target}.${randomUUID()}.tmp`;
  conversation.updatedAt = new Date().toISOString();
  await writeFile(temp, JSON.stringify(conversation), 'utf8');
  await rename(temp, target);
}
export async function listConversations(userId: string) {
  const root = userRoot(userId);
  const entries = await readdir(root).catch(() => [] as string[]);
  const items = await Promise.all(entries.filter(f => f.endsWith('.json')).map(async f => {
    try {
      const c: Conversation = JSON.parse(await readFile(path.join(root, f), 'utf8'));
      return { id: c.id, title: c.title, updatedAt: c.updatedAt };
    } catch { return null; }
  }));
  return items.filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function deleteConversation(userId: string, id: string) {
  if (!validId(id)) throw new Error('Conversation not found.');
  await unlink(path.join(userRoot(userId), `${id}.json`));
}
