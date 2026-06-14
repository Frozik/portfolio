import { useFunction } from '@frozik/components/hooks/useFunction';
import { LogOut } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { cn } from '../lib/cn';
import { sharedT } from '../translations';
import { Avatar } from '../ui/Avatar';
import { useAuthSession } from './CommunicationProvider';

/**
 * Compact identity surface that pairs a Google profile picture
 * (initial fallback when the user's account has no avatar) with
 * the signed-in user's name and email, plus a sign-out icon-button
 * on the right. Lives next to the Lobby's identity widget on retro
 * and conf, and floats in the top-right of the conf room.
 *
 * Hidden when not signed in so callers can drop it into their layout
 * without an extra `if` at the call site.
 */
export const AccountChip = observer(
  ({
    className,
  }: {
    /**
     * Tailwind class overrides applied to the root element. Lobbies use
     * this to align the chip with their nearby identity widgets without
     * leaking layout decisions into this shared module.
     */
    readonly className?: string;
  }) => {
    const session = useAuthSession();
    const handleClick = useFunction(() => {
      session.signOut();
    });

    if (!session.isSignedIn || session.profile === null) {
      return null;
    }

    const { name, email, pictureUrl } = session.profile;
    const initial = (name.trim()[0] ?? email?.trim()[0] ?? '?').toUpperCase();
    const displayedEmail = email ?? sharedT.accountChip.noEmailFallback;
    // Lookup is exhaustive over TIdentityProvider — adding a new provider
    // forces a translation entry, the TypeScript compiler refuses to
    // build until both en/ru maps cover the new key.
    const providerLabel =
      session.provider !== null ? sharedT.accountChip.providerLabels[session.provider] : '';
    const tooltip = `${providerLabel}${email !== undefined ? ` · ${email}` : ''}`;

    return (
      <div
        className={cn(
          'inline-flex items-center gap-2.5 rounded-full border border-landing-border bg-landing-surface py-1 pr-1 pl-1.5 text-landing-fg',
          className
        )}
        title={tooltip}
      >
        <Avatar src={pictureUrl} alt={name} size="sm" className="h-7 w-7 shrink-0 text-[11px]">
          {initial}
        </Avatar>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-xs font-medium">{name}</span>
          <span className="truncate text-[11px] text-landing-fg-dim">{displayedEmail}</span>
        </div>
        <button
          type="button"
          onClick={handleClick}
          aria-label={sharedT.accountChip.signOutAriaLabel}
          className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-landing-fg-dim transition-colors hover:bg-landing-bg-elev/60 hover:text-landing-fg"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }
);
