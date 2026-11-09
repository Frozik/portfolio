import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { ScheduleEditor } from '../../contexts/policy/application/ScheduleEditor';
import type { ITimeZone } from '../../contexts/policy/domain/ports/time-zones';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Hint } from '../kit/Hint';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { TextField } from '../kit/TextField';
import { gmtOffset } from './gmt-offset';

/** Enough to scroll through; a few letters of a city narrow the rest. */
const SHOWN_ZONES = 60;

function matches(zone: ITimeZone, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return (
    needle === '' ||
    zone.city.toLowerCase().includes(needle) ||
    zone.name.toLowerCase().includes(needle) ||
    zone.id.toLowerCase().includes(needle) ||
    gmtOffset(zone.offsetMinutes).toLowerCase().includes(needle)
  );
}

/** The time zone of a schedule: «where I am» first, then every zone, found by city or name. */
export const ZoneSheet = observer(function ZoneSheet({
  editor,
  onClose,
}: {
  readonly editor: ScheduleEditor;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const [query, setQuery] = useState('');
  const choose = (zone: ScheduleEditor['zone']) => {
    editor.setZone(zone);
    onClose();
  };
  const phone = app.timeZones.find(zone => zone.id === app.device.timeZone);
  const found = app.timeZones.filter(zone => matches(zone, query));
  const current = editor.zone;
  return (
    <Sheet visible title={texts.schedule.timeZone} onClose={onClose} testID="zone-sheet">
      <TextField
        testID="zone-search"
        label={texts.schedule.zoneSearch}
        placeholder={texts.schedule.zoneSearch}
        value={query}
        onChange={setQuery}
      />
      <Section>
        {query === '' ? (
          <Row
            testID="zone-here"
            title={`${current.kind === 'here' ? '✓ ' : ''}${texts.schedule.zoneHere}`}
            subtitle={texts.schedule.zoneHereHint}
            onPress={() => choose({ kind: 'here' })}
          />
        ) : null}
        {query === '' && phone !== undefined ? (
          <Row
            testID="zone-phone"
            title={`${current.kind === 'fixed' && current.zone === phone.id ? '✓ ' : ''}${phone.city}`}
            subtitle={`${gmtOffset(phone.offsetMinutes)} · ${phone.name}`}
            onPress={() => choose({ kind: 'fixed', zone: phone.id })}
          />
        ) : null}
        {found.slice(0, SHOWN_ZONES).map(zone => (
          <Row
            key={zone.id}
            testID={`zone-${zone.id}`}
            title={`${current.kind === 'fixed' && current.zone === zone.id ? '✓ ' : ''}${zone.city}`}
            subtitle={`${gmtOffset(zone.offsetMinutes)} · ${zone.name}`}
            onPress={() => choose({ kind: 'fixed', zone: zone.id })}
          />
        ))}
      </Section>
      {found.length > SHOWN_ZONES ? <Hint text={`… ${found.length - SHOWN_ZONES}`} /> : null}
    </Sheet>
  );
});
