import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { APP_ID } from '../server/chat';

export default createEndpoint({
  description: 'Starts a direct message or custom group chat (reuses an existing direct message)',
  authenticated: true,
  inputSchema: z.object({
    memberIds: z.array(z.string()).min(1).max(100),
    name: z.string().max(80).optional(),
    description: z.string().max(500).optional(),
    emoji: z.string().max(16).optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const others = [...new Set(input.memberIds.filter((i) => i !== me))];
    if (!others.length) throw new ZiteError('Pick at least one person');

    const { records } = await zite.auth.findAllUsers({ appIds: [APP_ID], limit: 2000 });
    const valid = new Set(records.map((u) => u.id));
    if (others.some((o) => !valid.has(o))) throw new ZiteError('Unknown person');

    const isGroup = others.length > 1 || !!input.name?.trim();
    if (!isGroup) {
      const existing = await zite.sql({
        query: `SELECT id FROM "Conversations" WHERE COALESCE("isGroup", false) = false AND "communityId" IS NULL
                AND "members" @> jsonb_build_array($1::text, $2::text) AND jsonb_array_length("members") = 2 LIMIT 1`,
        params: [me, others[0]],
      });
      if (existing.rows[0]) return { id: String(existing.rows[0].id) };
    }
    const c = await zite.conversations.create({
      record: {
        name: input.name?.trim() || null,
        isGroup,
        members: [me, ...others],
        owner: isGroup ? me : null,
        admins: isGroup ? [me] : null,
        description: input.description?.trim() || null,
        emoji: input.emoji?.trim() || null,
        communityId: null,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: null,
        messages: null, reactions: null, readReceipts: null,
      } as never,
    });
    return { id: c.id };
  },
});
