import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';
import type { Temporal } from 'temporal-polyfill';

import type { TSyncState } from '../../contexts/sync/domain/sync-state';
import type { ITexts } from '../../texts/texts';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { momentText } from '../format';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';

function stateText(
  texts: ITexts,
  state: TSyncState,
  moment: (instant: Temporal.Instant) => string
): string {
  switch (state.kind) {
    case 'off':
      return texts.sync.state.off;
    case 'syncing':
      return texts.sync.state.syncing;
    case 'synced':
      return texts.sync.state.synced(moment(state.at));
    case 'failed':
      return texts.sync.state[state.failure];
    case 'unreadable':
      return texts.sync.state.unreadable;
    default:
      return assertNever(state);
  }
}

/** Keeping the groups in the user's own Google Drive: connect, see how it goes, disconnect. */
export const SyncSection = observer(function SyncSection() {
  const app = useApp();
  const texts = useTexts();
  const { sync, clock } = app;
  const moment = (instant: Temporal.Instant) =>
    momentText(
      texts,
      instant.toZonedDateTimeISO(clock.timeZone()).toPlainDateTime(),
      clock.localNow().toPlainDate()
    );
  return (
    <Section title={texts.sync.title}>
      {sync.connection === null ? (
        <>
          <Row testID="sync-what" title={texts.sync.state.off} subtitle={texts.sync.what} />
          <Button
            testID="sync-connect"
            label={texts.sync.connect}
            onPress={() => void sync.connect()}
          />
        </>
      ) : (
        <>
          <Row
            testID={`sync-state-${sync.state.kind}`}
            title={texts.sync.account(sync.connection.account)}
            subtitle={stateText(texts, sync.state, moment)}
          />
          {sync.state.kind === 'unreadable' ? (
            <>
              <Hint tone="caution" text={texts.sync.state.unreadable} />
              <Button
                testID="sync-replace"
                variant="danger"
                label={texts.sync.replace}
                onPress={() => void sync.replaceCloudCopy()}
              />
            </>
          ) : null}
          {sync.state.kind === 'failed' && sync.state.failure === 'auth-required' ? (
            <Button
              testID="sync-reconnect"
              label={texts.sync.connect}
              onPress={() => void sync.connect()}
            />
          ) : null}
          <Button
            testID="sync-now"
            variant="secondary"
            label={texts.sync.now}
            disabled={sync.state.kind === 'syncing'}
            onPress={() => void sync.syncNow()}
          />
          <Button
            testID="sync-disconnect"
            variant="quiet"
            label={texts.sync.disconnect}
            onPress={() => void sync.disconnect()}
          />
        </>
      )}
    </Section>
  );
});
