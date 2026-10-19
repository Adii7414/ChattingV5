import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';

export default createEndpoint({
  description: 'Casts or changes your vote on a poll message',
  authenticated: true,
  inputSchema: z.object({ messageId: z.string(), option: z.number().int().min(0) }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const msg = await zite.messages.findOne({ id: input.messageId });
    if (!msg?.poll) throw new ZiteError('Poll not found');
    await requireMember(ids(msg.conversation)[0] ?? '', me);
    const p = JSON.parse(String(msg.poll)) as { options: string[]; multi?: boolean; votes?: Record<string, number[]> };
    if (input.option >= p.options.length) throw new ZiteError('Unknown option');
    const votes = p.votes ?? {};
    const mine = votes[me] ?? [];
    const has = mine.includes(input.option);
    votes[me] = p.multi ? (has ? mine.filter((o) => o !== input.option) : [...mine, input.option]) : has ? [] : [input.option];
    if (!votes[me].length) delete votes[me];
    await zite.messages.update({ id: msg.id, record: { poll: JSON.stringify({ ...p, votes }) } as never });
    return { ok: true };
  },
});
