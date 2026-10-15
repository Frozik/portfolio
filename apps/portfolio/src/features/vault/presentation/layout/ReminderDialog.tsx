import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import type { ReminderModel } from '@frozik/vault-app/keys/application/ReminderModel';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { PasswordAction } from '@frozik/vault-react/form/PasswordAction';
import { keysT } from '@frozik/vault-react/texts/keys';
import { vaultT } from '@frozik/vault-react/texts/vault';

/** The weekly master-password reminder: it asks, it never locks; "Not now" asks again next time. */
export const ReminderDialog = observer(({ reminder }: { readonly reminder: ReminderModel }) => {
  const t = keysT.reminder;
  const { state } = reminder;
  return (
    <DialogShell
      open={state.kind !== 'quiet'}
      onClose={reminder.dismiss}
      title={t.title}
      description={t.body}
      footer={
        <Button
          type="button"
          variant="secondary"
          data-testid="reminder-later"
          onClick={reminder.dismiss}
        >
          {t.later}
        </Button>
      }
    >
      <div data-testid="reminder" data-state={state.kind}>
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
      </div>
    </DialogShell>
  );
});
