import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, Clock, Copy, Loader2, MessageCircle } from 'lucide-react';
import { bannerStyle } from './banners';
import { blockUser, createConversation, getPerson, type GetPersonOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import PersonAvatar from './Avatars';
import { useChat } from './store';

export default function PersonDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { people, refresh, conversations, communities, titleOf } = useChat();
  const navigate = useNavigate();
  const [p, setP] = useState<GetPersonOutputType['profile'] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setP(undefined);
    if (userId) getPerson({ userId }).then((r) => setP(r.profile)).catch(() => setP(null));
    if (userId) blockUser({}).then((r) => setBlocked(r.blocked.includes(userId))).catch(() => {});
  }, [userId]);
  const online = userId ? people.get(userId)?.online : false;
  const mutual = userId ? (conversations ?? []).filter((c) => c.isGroup && !c.communityId && c.memberIds.includes(userId)) : [];
  const mutualComms = userId ? communities.filter((cm) => (conversations ?? []).some((c) => c.communityId === cm.id && c.memberIds.includes(userId))) : [];
  const localTime = (tz: string) => { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date()); } catch { return null; } };

  const message = async () => {
    if (!userId) return;
    setBusy(true);
    try { const { id } = await createConversation({ memberIds: [userId] }); await refresh(); onClose(); navigate(`/app/c/${id}`); }
    catch { toast.error('Couldn’t open the chat'); } finally { setBusy(false); }
  };

  const toggleBlock = async () => {
    if (!userId) return;
    const next = !blocked; setBlocked(next);
    try { await blockUser({ userId }); toast.success(next ? `Blocked ${p?.name ?? 'them'}` : 'Unblocked'); window.dispatchEvent(new CustomEvent('chat:blocks')); }
    catch { setBlocked(!next); toast.error('Couldn’t update'); }
  };

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {p === undefined ? <div className="grid h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : p === null ? <><DialogTitle>Profile unavailable</DialogTitle><DialogDescription>You can only see people you share a chat or community with.</DialogDescription></>
          : (
            <div className="-mx-6 -mt-6 flex flex-col items-center text-center">
              <div className="h-24 w-full rounded-t-lg" style={bannerStyle(p.banner)} />
              <div className="-mt-11 rounded-full border-4 border-background"><PersonAvatar name={p.name} image={p.image} size={80} online={online} /></div>
              <div className="flex w-full flex-col items-center px-6 pb-1">
              <DialogTitle className="mt-4 text-xl tracking-tight">{p.name}</DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-1">{[p.pronouns, p.email].filter(Boolean).join(' · ')}
                {p.email && <button onClick={() => { navigator.clipboard.writeText(p.email); toast.success('Email copied'); }} aria-label="Copy email" className="rounded p-0.5 hover:bg-secondary"><Copy className="h-3 w-3" /></button>}</DialogDescription>
              {p.timeZone && localTime(p.timeZone) && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {localTime(p.timeZone)} local time</p>}
              {(p.statusText || p.statusEmoji) && <p className="mt-3 rounded-full bg-secondary px-3 py-1 text-sm">{p.statusEmoji} {p.statusText}</p>}
              {p.bio && <p className="mt-4 whitespace-pre-wrap text-sm">{p.bio}</p>}
              <p className="mt-4 text-xs text-muted-foreground">{online ? 'Online now' : p.lastSeenAt ? `Last seen ${formatDistanceToNowStrict(new Date(p.lastSeenAt))} ago` : 'Last seen a while ago'}</p>
              {(mutual.length > 0 || mutualComms.length > 0) && (
                <div className="mt-4 w-full text-left">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In common</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mutualComms.map((c) => <span key={c.id} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{c.emoji || '🏘️'} {c.name}</span>)}
                    {mutual.map((c) => <button key={c.id} onClick={() => { onClose(); navigate(`/app/c/${c.id}`); }} className="rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70">{titleOf(c)}</button>)}
                  </div>
                </div>
              )}
              <button onClick={message} disabled={busy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground font-medium text-background">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Message
              </button>
              <button onClick={toggleBlock} className={`mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-medium ${blocked ? 'border border-border' : 'text-destructive hover:bg-destructive/10'}`}>
                <Ban className="h-4 w-4" /> {blocked ? 'Unblock' : 'Block'}
              </button>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
