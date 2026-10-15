import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Button } from '@frozik/components/ui/Button';
import { Drawer } from '@frozik/components/ui/Drawer';
import type { ReminderModel } from '@frozik/vault-app/keys/application/ReminderModel';
import { PasswordAction } from '@frozik/vault-react/form/PasswordAction';
import { keysT } from '@frozik/vault-react/texts/keys';
import { vaultT } from '@frozik/vault-react/texts/vault';

/** The weekly master-password reminder: a sheet that asks and never locks; "Not now" asks again next time. */
export const ReminderSheet = observer(({ reminder }: { readonly reminder: ReminderModel }) => {
  const t = keysT.reminder;
  const { state } = reminder;
  return (
    <Drawer title={t.title} open={state.kind !== 'quiet'} onClose={reminder.dismiss} mobile="sheet">
      <div className="flex flex-col gap-4" data-testid="reminder" data-state={state.kind}>
        <p className="text-[14px] text-fg-dim">{t.body}</p>
        <PasswordAction
          label={t.password}
          submitLabel={t.submit}
          workingLabel={keysT.quick.checking}
          working={state.kind === 'checking'}
          error={
            state.kind === 'due' && !isNil(state.failure)
              ? vaultT.unlock.failures[state.failure]
              : null
          }
          onSubmit={password => void reminder.submit(password)}
        />
        <Button
          type="button"
          variant="secondary"
          data-testid="reminder-later"
          onClick={reminder.dismiss}
        >
          {t.later}
        </Button>
      </div>
    </Drawer>
  );
});
