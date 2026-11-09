import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { INumberQuery } from '../../contexts/screening/application/number-check';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { CALL_GLYPHS } from '../calls/call-state';
import { groupName } from '../group-name';
import { statusText } from '../groups/group-status';
import { BackButton } from '../kit/BackButton';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { TEXT_SIZE } from '../kit/metrics';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { TextField } from '../kit/TextField';
import { ToggleRow } from '../kit/ToggleRow';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';

const EMPTY_QUERY: INumberQuery = { number: '', networkName: '', hidden: false };

const CheckResult = observer(function CheckResult({ query }: { readonly query: INumberQuery }) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const scheme = useScheme();
  if (!query.hidden && query.number.trim() === '') {
    return <Hint text={texts.check.hint} />;
  }
  const found = app.check(query);
  if (found.kind === 'no-number') {
    return <Hint testID="check-no-number" tone="caution" text={texts.check.noNumber} />;
  }
  const { caller, decision } = found;
  const { group, verdict, alsoClaimedBy } = decision;
  return (
    <>
      <Section>
        <Row
          testID={`check-verdict-${verdict}`}
          title={groupName(texts, group)}
          subtitle={texts.verdicts[verdict]}
          leading={<Dot color={groupColor(group.color, scheme)} />}
          trailing={<Text style={styles.glyph}>{CALL_GLYPHS[verdict]}</Text>}
          onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
        />
      </Section>
      <Hint
        text={statusText(
          texts,
          app.statusOf(group),
          app.clock.timeZone(),
          app.clock.localNow().toPlainDate()
        )}
      />
      {caller.contact === null ? null : (
        <Hint testID="check-contact" text={texts.check.contact(caller.contact.displayName)} />
      )}
      {alsoClaimedBy.length === 0 ? null : (
        <Hint
          testID="check-conflict"
          tone="caution"
          text={texts.check.conflict(
            alsoClaimedBy.map(other => `«${groupName(texts, other)}»`).join(', ')
          )}
        />
      )}
    </>
  );
});

/** «Check a number»: a number (or a hidden one) and an operator's name, answered as a call now. */
export function CheckScreen() {
  const texts = useTexts();
  const [query, setQuery] = useState(EMPTY_QUERY);
  return (
    <Screen testID="check-screen" title={texts.check.title} header={<BackButton />}>
      {query.hidden ? null : (
        <TextField
          testID="check-number"
          label={texts.check.number}
          placeholder={texts.check.numberPlaceholder}
          keyboard="phone-pad"
          value={query.number}
          onChange={number => setQuery({ ...query, number })}
        />
      )}
      <TextField
        testID="check-network-name"
        label={texts.check.networkName}
        placeholder={texts.check.networkName}
        value={query.networkName}
        onChange={networkName => setQuery({ ...query, networkName })}
      />
      <Section>
        <ToggleRow
          testID="check-hidden"
          title={texts.check.hidden}
          value={query.hidden}
          onChange={hidden => setQuery({ ...query, hidden })}
        />
      </Section>
      <CheckResult query={query} />
    </Screen>
  );
}

const styles = StyleSheet.create({ glyph: { fontSize: TEXT_SIZE.heading } });
