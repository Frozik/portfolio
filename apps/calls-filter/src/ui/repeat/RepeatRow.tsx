import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { TRepeatPass } from '../../contexts/policy/domain/repeat-pass';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Row } from '../kit/Row';
import { repeatText } from './repeat-text';
import { RepeatSheet } from './RepeatSheet';

/** The switch as a row: its state under the title, the sheet one tap away. */
export const RepeatRow = observer(function RepeatRow({
  value,
  hint,
  onChange,
  testID,
}: {
  readonly value: TRepeatPass;
  readonly hint: string;
  readonly onChange: (repeat: TRepeatPass) => void;
  readonly testID: string;
}) {
  const app = useApp();
  const texts = useTexts();
  const [open, setOpen] = useState(false);
  const { clock } = app;
  return (
    <>
      <Row
        testID={testID}
        title={`🔁 ${texts.repeat.title}`}
        subtitle={repeatText(
          texts,
          value,
          clock.now(),
          clock.timeZone(),
          clock.localNow().toPlainDate()
        )}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <RepeatSheet value={value} hint={hint} onChange={onChange} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
});
