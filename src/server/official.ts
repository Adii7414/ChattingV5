import { zite } from 'zitejs/db';

export type Official = 'Chatting' | 'Chatting Support';
export const OFFICIAL_ID: Record<Official, string> = { Chatting: 'official:chatting', 'Chatting Support': 'official:support' };
export const officialOf = (v: unknown): Official | null => (v === 'Chatting' || v === 'Chatting Support' ? v : null);

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111418"/><path d="M14 30a16 16 0 1 1 16 16H14z" fill="#fff"/><circle cx="44" cy="44" r="9" fill="#22c55e" stroke="#111418" stroke-width="4"/></svg>`;
export const OFFICIAL_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

export const SUPPORT_OPTIONS = ['Account & login', 'Something’s broken', 'Report abuse', 'Appeal a suspension', 'Billing', 'Feature idea', 'Other'];
export const optionCategory = (o: string): { category: string; tags: string[] } => ({
  'Account & login': { category: 'Account', tags: [] },
  'Something’s broken': { category: 'Bug', tags: [] },
  'Report abuse': { category: 'Abuse', tags: [] },
  'Appeal a suspension': { category: 'Account', tags: ['Appeal'] },
  Billing: { category: 'Billing', tags: [] },
  'Feature idea': { category: 'Feature request', tags: [] },
}[o] ?? { category: 'Other', tags: [] });

/** Finds the user's DM with an official account, optionally creating it. */
export async function findOfficialChat(userId: string, account: Official) {
  const r = await zite.sql({
    query: `SELECT id FROM "Conversations" WHERE "members" @> jsonb_build_array($1::text) AND "officialAccount" = $2 ORDER BY created_at LIMIT 1`,
    params: [userId, account],
  });
  return r.rows[0] ? String(r.rows[0].id) : null;
}

export async function ensureOfficialChat(userId: string, account: Official) {
  const found = await findOfficialChat(userId, account);
  if (found) return { id: found, created: false };
  const c = await zite.conversations.create({ record: { members: [userId], isGroup: false, name: null, officialAccount: account } as never });
  return { id: c.id, created: true };
}

/** Posts a message as an official account. Only server code can do this. */
export async function postOfficial(cid: string, account: Official, body: string, opts: { staffName?: string | null; quickReplies?: string[] } = {}) {
  const now = new Date().toISOString();
  const preview = `${opts.staffName ? `${opts.staffName}: ` : ''}${body}`.replace(/\s+/g, ' ').slice(0, 140);
  const [m] = await Promise.all([
    zite.messages.create({ record: { body, conversation: cid, sender: null, officialSender: account, staffName: opts.staffName ?? null, quickReplies: opts.quickReplies ? JSON.stringify(opts.quickReplies) : null } as never }),
    zite.conversations.update({ id: cid, record: { lastMessageAt: now, lastMessagePreview: preview, archivedBy: [] } as never }),
  ]);
  return m.id;
}

export const SUPPORT_GREETING = 'Welcome to Chatting Support 👋 Please let us know what issue you’re facing:';
