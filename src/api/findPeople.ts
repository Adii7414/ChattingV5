import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { APP_ID } from '../server/chat';

export default createEndpoint({
  description: 'Finds people who use Chatting, to start a conversation with',
  authenticated: true,
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ people: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable() })) }),
  execute: async ({ input, context }) => {
    const q = input.query.trim().toLowerCase();
    const { records } = await zite.auth.findAllUsers({ appIds: [APP_ID], limit: 500 });
    const people = records
      .filter((u) => u.id !== context.user.id)
      .filter((u) => !q || u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
      .slice(0, 20)
      .map((u) => ({ id: u.id, name: u.name || u.email.split('@')[0], email: u.email, image: u.image ?? null }));
    return { people };
  },
});
