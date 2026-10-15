import { isNil } from 'lodash-es';
import { Menu } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { saveStatusText } from '@frozik/vault-app/texts/vault/status-wording';
import { auditT } from '@frozik/vault-react/texts/audit';
import { settingsT } from '@frozik/vault-react/texts/settings';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { shortcutLabel } from '../shortcut-label';
import { vaultPaths } from '../vault-paths';
import { CloudStatus } from './CloudStatus';

const MS_PER_SECOND = 1000;
const LOCK_KEY = 'l';
const BACK_KEY = 'Escape';
const MENU_ICON_SIZE = 18;

/**
 * The vault's name, whether this device holds its
 * changes, lock and settings; `Ctrl/⌘+L` locks and `Esc` goes back where
 * nothing else took it (an open editor, a dialog or a popup handles its own).
 */
export const VaultHeader = observer(
  ({
    session,
    onLock,
    onBack,
    onMenu,
  }: {
    readonly session: VaultSession;
    readonly onLock: () => void;
    readonly onBack: (() => void) | null;
    /** On a narrow screen the sections and groups slide in from the left. */
    readonly onMenu: () => void;
  }) => {
    useEffect(() => {
      const controller = new AbortController();
      window.addEventListener(
        'keydown',
        event => {
          if (event.defaultPrevented) {
            return;
          }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === LOCK_KEY) {
            event.preventDefault();
            onLock();
          } else if (event.key === BACK_KEY && !isNil(onBack)) {
            onBack();
          }
        },
        { signal: controller.signal }
      );
      return () => controller.abort();
    }, [onLock, onBack]);

    const t = vaultT.status;
    const failure = session.deviceStoreFailure;
    const stopped = session.local.state.phase.kind === 'stopped';
    return (
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={vaultT.sidebar.open}
            title={vaultT.sidebar.open}
            onClick={onMenu}
          >
            <Menu size={MENU_ICON_SIZE} />
          </Button>
          <h2 className="text-[20px] font-medium text-landing-fg">
            {session.document.settings.name}
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onLock}
            title={shortcutLabel('L')}
          >
            {vaultT.session.lock}
          </Button>
          <NavLink
            to={vaultPaths.audit(session.vaultKey)}
            className="text-[13px] text-landing-fg-dim underline"
          >
            {auditT.open}
            {session.audit.problems.size > 0 && ` · ${session.audit.problems.size}`}
          </NavLink>
          <NavLink
            to={vaultPaths.settings(session.vaultKey)}
            className="text-[13px] text-landing-fg-dim underline"
          >
            {settingsT.open}
          </NavLink>
          <span
            className={stopped ? 'text-[12px] text-error' : 'text-[12px] text-landing-fg-faint'}
          >
            {saveStatusText(vaultT, session.local.state)}
          </span>
          <CloudStatus cloud={session.cloud} />
          <span aria-live="polite" className="text-[12px] text-landing-fg-faint">
            {isNil(session.clipboard.clearsAt)
              ? ''
              : vaultT.card.copied(session.clipboard.clearAfterMs / MS_PER_SECOND)}
          </span>
        </div>
        {session.readOnly && <Alert type="warning" message={t.readOnly} />}
        {!isNil(failure) && (
          <Alert
            type="error"
            message={failure.kind === 'quota' ? t.storageFull : t.storageBlocked}
          />
        )}
      </header>
    );
  }
);
