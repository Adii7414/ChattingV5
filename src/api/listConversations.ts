import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { iso } from '../server/chat';
import { OFFICIAL_ID, OFFICIAL_LOGO, officialOf } from '../server/official';

const person = z.object({
  id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable(), online: z.boolean(),
  statusText: z.string().nullable(), statusEmoji: z.string().nullable(),
});

export default createEndpoint({
  description: 'Lists the signed-in user’s conversations, channels and communities with unread counts',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    conversations: z.array(z.object({
      id: z.string(), name: z.string().nullable(), isGroup: z.boolean(), memberIds: z.array(z.string()),
      adminIds: z.array(z.string()), ownerId: z.string().nullable(), description: z.string().nullable(), emoji: z.string().nullable(),
      communityId: z.string().nullable(), pinned: z.boolean(), muted: z.boolean(), archived: z.boolean(),
      lastMessageAt: z.string().nullable(), preview: z.string().nullable(), unread: z.number(), settings: z.string(), disappearAfter: z.number(), official: z.string().nullable(),
    })),
    communities: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string().nullable(), description: z.string().nullable(), ownerId: z.string().nullable(), memberCount: z.number(), isPublic: z.boolean(), settings: z.string() })),
    people: z.array(person),
  }),
  execute: async ({ context }) => {
    const me = context.user.id;
    const [convs, comms, people] = await Promise.all([
      zite.sql({
        query: `
          SELECT c.id, c."name", c."isGroup", c."members", c."admins", c."owner"->>0 AS "ownerId", c."description", c."emoji", c."communityId", c."settings", c."disappearAfter", c."officialAccount",
            COALESCE(c."pinnedBy", '[]'::jsonb) @> jsonb_build_array($1::text) AS pinned,
            COALESCE(c."mutedBy", '[]'::jsonb) @> jsonb_build_array($1::text) AS muted,
            COALESCE(c."archivedBy", '[]'::jsonb) @> jsonb_build_array($1::text) AS archived,
            c."lastMessageAt", c."lastMessagePreview", c.created_at AS "createdAt",
            (SELECT COUNT(*) FROM "ConversationsMessages" l JOIN "Messages" m ON m.id = l."messagesId"
              WHERE l."conversationsId" = c.id AND COALESCE(m."sender"->>0, '') <> $1 AND NULLIF(m."parentMessageId", '') IS NULL
                AND m.created_at > COALESCE((SELECT MAX(r."lastReadAt") FROM "ReadReceipts" r WHERE r."key" = c.id::text || ':' || $1), 'epoch'::timestamptz)
            ) AS unread
          FROM "Conversations" c
          WHERE c."members" @> jsonb_build_array($1::text)
          ORDER BY COALESCE(c."lastMessageAt", c.created_at) DESC
          LIMIT 300`,
        params: [me],
      }),
      zite.sql({
        query: `SELECT id, "name", "emoji", "description", "owner"->>0 AS "ownerId", COALESCE(jsonb_array_length("members"), 0) AS n, COALESCE("isPublic", true) AS "isPublic", "settings"
                FROM "Communities" WHERE "members" @> jsonb_build_array($1::text) ORDER BY "name"`,
        params: [me],
      }),
      zite.sql({
        query: `
          SELECT DISTINCT u.id::text AS id, u."name", u."email", u."image", p."lastSeenAt",
            COALESCE(pr."showOnlineStatus", true) AS "showOnline", CASE WHEN pr."statusExpiresAt" IS NULL OR pr."statusExpiresAt" > now() THEN pr."statusText" END AS "statusText", CASE WHEN pr."statusExpiresAt" IS NULL OR pr."statusExpiresAt" > now() THEN pr."statusEmoji" END AS "statusEmoji"
          FROM "Conversations" c
          CROSS JOIN LATERAL jsonb_array_elements_text(c."members") AS mid
          JOIN "ziteUsers" u ON u.id::text = mid
          LEFT JOIN "Presence" p ON p."userKey" = u.id::text
          LEFT JOIN "Profiles" pr ON pr."userKey" = u.id::text
          WHERE c."members" @> jsonb_build_array($1::text)`,
        params: [me],
      }),
    ]);
    const now = Date.now();
    const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
    return {
      conversations: convs.rows.map((r) => ({
        official: officialOf(r.officialAccount),
        id: String(r.id),
        name: r.name ? String(r.name) : null,
        isGroup: Boolean(r.isGroup),
        memberIds: officialOf(r.officialAccount) ? [me, OFFICIAL_ID[officialOf(r.officialAccount)!]] : arr(r.members),
        adminIds: arr(r.admins),
        ownerId: r.ownerId ? String(r.ownerId) : null,
        description: r.description ? String(r.description) : null,
        emoji: r.emoji ? String(r.emoji) : null,
        communityId: r.communityId ? String(r.communityId) : null,
        pinned: Boolean(r.pinned),
        muted: Boolean(r.muted),
        archived: Boolean(r.archived),
        lastMessageAt: iso(r.lastMessageAt ?? r.createdAt),
        preview: r.lastMessagePreview ? String(r.lastMessagePreview) : null,
        unread: Number(r.unread ?? 0),
        settings: String(r.settings ?? ''),
        disappearAfter: Number(r.disappearAfter ?? 0),
      })),
      communities: comms.rows.map((r) => ({
        id: String(r.id), name: String(r.name ?? 'Community'), emoji: r.emoji ? String(r.emoji) : null,
        description: r.description ? String(r.description) : null, ownerId: r.ownerId ? String(r.ownerId) : null,
        memberCount: Number(r.n), isPublic: Boolean(r.isPublic), settings: String(r.settings ?? ''),
      })),
      people: [...(['Chatting', 'Chatting Support'] as const).filter((a) => convs.rows.some((r) => r.officialAccount === a)).map((a) => ({
        id: OFFICIAL_ID[a], name: a, email: '', image: OFFICIAL_LOGO, online: false, statusText: null, statusEmoji: null,
      })), ...people.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name || r.email || 'Someone'),
        email: String(r.email ?? ''),
        image: r.image ? String(r.image) : null,
        online: (r.id === me || Boolean(r.showOnline)) && !!r.lastSeenAt && now - new Date(String(r.lastSeenAt)).getTime() < 75_000,
        statusText: r.statusText ? String(r.statusText) : null,
        statusEmoji: r.statusEmoji ? String(r.statusEmoji) : null,
      }))],
    };
  },
});
