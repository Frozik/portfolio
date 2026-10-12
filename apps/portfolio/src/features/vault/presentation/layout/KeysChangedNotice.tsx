import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import type { SessionKeys } from '../../application/SessionKeys';
import { keysT } from '../translations/keys';

/**
 * The slots changed under the session: opened
 * with the recovery key (a new password is due), or a newer set came from
 * another device (the old password no longer opens the vault).
 */
export const KeysChangedNotice = observer(
  ({ keys, settingsPath }: { readonly keys: SessionKeys; readonly settingsPath: string }) => {
    if (keys.recovering) {
      const t = keysT.recovering;
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Alert
            type="warning"
            message={t.message}
            description={t.description}
            data-testid="opened-with-recovery-key"
          />
          <NavLink to={settingsPath} className="text-[13px] text-landing-fg underline">
            {t.action}
          </NavLink>
        </div>
      );
    }
    if (!keys.changedElsewhere) {
      return null;
    }
    const t = keysT.changedElsewhere;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Alert type="info" message={t.message} description={t.description} />
        <Button type="button" size="sm" variant="ghost" onClick={keys.dismissNotice}>
          {t.dismiss}
        </Button>
      </div>
    );
  }
);
