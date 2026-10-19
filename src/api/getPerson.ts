import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Shows another person’s public profile (only people you share a conversation or community with)',
  authenticated: true,
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ profile: z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable(), bio: z.string(), pronouns: z.string(), statusText: z.string(), statusEmoji: z.string(), banner: z.string(), timeZone: z.string(), lastSeenAt: z.string().nullable() }).nullable() }),
  execute: async ({ input, context }) => {
    const r = await zite.sql({
      query: `
        SELECT u.id::text AS id, u."name", u."email", u."image", p."bio", p."pronouns", p."banner", p."timeZone", CASE WHEN p."statusExpiresAt" IS NULL OR p."statusExpiresAt" > now() THEN p."statusText" END AS "statusText", CASE WHEN p."statusExpiresAt" IS NULL OR p."statusExpiresAt" > now() THEN p."statusEmoji" END AS "statusEmoji",
          CASE WHEN COALESCE(p."showOnlineStatus", true) THEN pr."lastSeenAt" END AS "lastSeenAt"
        FROM "ziteUsers" u
        LEFT JOIN "Profiles" p ON p."userKey" = u.id::text
        LEFT JOIN "Presence" pr ON pr."userKey" = u.id::text
        WHERE u.id::text = $2 AND EXISTS (
          SELECT 1 FROM "Conversations" c WHERE c."members" @> jsonb_build_array($1::text, $2::text)
          UNION ALL SELECT 1 FROM "Communities" m WHERE m."members" @> jsonb_build_array($1::text, $2::text))`,
      params: [context.user.id, input.userId],
    });
    const x = r.rows[0];
    if (!x) return { profile: null };
    return {
      profile: {
        id: String(x.id), name: String(x.name || x.email), email: String(x.email ?? ''), image: x.image ? String(x.image) : null,
        bio: String(x.bio ?? ''), pronouns: String(x.pronouns ?? ''), statusText: String(x.statusText ?? ''), statusEmoji: String(x.statusEmoji ?? ''), banner: String(x.banner ?? ''), timeZone: String(x.timeZone ?? ''),
        lastSeenAt: x.lastSeenAt ? new Date(String(x.lastSeenAt)).toISOString() : null,
      },
    };
  },
});
