import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Tells others the signed-in user is typing in a conversation (or thread)',
  authenticated: true,
  inputSchema: z.object({ where: z.string().max(80).nullable() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const now = new Date().toISOString();
    await zite.presence.bulkCreate({
      records: [{ userKey: context.user.id, person: context.user.id, lastSeenAt: now, typingIn: input.where, typingAt: input.where ? now : null } as never],
      matchOn: ['userKey'],
    });
    return { ok: true };
  },
});
