import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

export const ids = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

const deny = (msg: string, user: string) => {
  const e = new ZiteError(msg);
  e.userFacingMessage = user;
  return e;
};

/** Loads a conversation and throws unless the user is one of its members. */
export async function requireMember(conversationId: string, userId: string) {
  const c = await zite.conversations.findOne({ id: conversationId });
  if (!c || !ids(c.members).includes(userId)) throw deny('Not a member of this conversation', 'You don’t have access to this conversation.');
  return c;
}

export const isAdmin = (c: { owner?: string | string[]; admins?: string | string[] }, userId: string) =>
  ids(c.owner).includes(userId) || ids(c.admins).includes(userId);

/** Loads a group/channel and throws unless the user can manage it. */
export async function requireAdmin(conversationId: string, userId: string) {
  const c = await requireMember(conversationId, userId);
  if (!isAdmin(c, userId)) throw deny('Not an admin', 'Only group admins can do that.');
  return c;
}

export async function requireCommunityMember(communityId: string, userId: string) {
  const c = await zite.communities.findOne({ id: communityId });
  if (!c || !ids(c.members).includes(userId)) throw deny('Not a community member', 'Join this community first.');
  return c;
}

export const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

export const APP_ID = 'm5tkkd2dus';
