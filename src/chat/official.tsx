import { BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { officialChat } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';

export const isOfficialId = (id: string | null | undefined) => !!id && id.startsWith('official:');

export function Verified({ className }: { className?: string }) {
  return <BadgeCheck aria-label="Verified official account" className={cn('h-4 w-4 shrink-0 fill-primary text-primary-foreground', className)} />;
}

/** Opens (or reopens) the Chatting Support chat and navigates to it. */
export async function openSupport(navigate: (to: string) => void, refresh: () => Promise<void>) {
  try {
    const r = await officialChat({ action: 'openSupport' });
    await refresh();
    if (r.conversationId) navigate(`/app/c/${r.conversationId}`);
  } catch {
    toast.error('Couldn’t open support right now');
  }
}
