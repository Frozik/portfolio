import { setStringAsync } from 'expo-clipboard';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { BackButton } from '../kit/BackButton';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { GUTTER, TEXT_SIZE } from '../kit/metrics';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { SelectRow } from '../kit/SelectRow';
import { Wrap } from '../kit/Wrap';
import { usePalette } from '../theme/AppTheme';

/** How long the call log is kept: the lists show that far back, and the service keeps that much. */
const JOURNAL_TERMS = [30, 90, 180, 365] as const;

/** What the app and the service did, filtered, and the file to send to a messenger. */
export const DiagnosticsScreen = observer(function DiagnosticsScreen() {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const { diagnostics } = app;
  useEffect(() => {
    diagnostics.refresh();
  }, [diagnostics]);
  const zone = app.clock.timeZone();
  return (
    <Screen testID="diagnostics-screen" title={texts.diagnostics.title} header={<BackButton />}>
      <Wrap>
        <Button
          testID="diagnostics-share"
          label={texts.diagnostics.share}
          onPress={() => void diagnostics.shareFile()}
        />
        <Button
          testID="diagnostics-copy"
          variant="secondary"
          label={texts.diagnostics.copy}
          onPress={() => void setStringAsync(diagnostics.copyText())}
        />
      </Wrap>
      <Section>
        <SelectRow
          testID="diagnostics-filter"
          title={texts.diagnostics.shown}
          options={[
            { value: 'all', label: texts.diagnostics.all, testID: 'diagnostics-all' },
            { value: 'errors', label: texts.diagnostics.errors, testID: 'diagnostics-errors' },
            ...diagnostics.categories.map(category => ({
              value: `category:${category}`,
              label: category,
              testID: `diagnostics-category-${category}`,
            })),
          ]}
          value={
            diagnostics.filter.kind === 'category'
              ? `category:${diagnostics.filter.category}`
              : diagnostics.filter.kind
          }
          onChange={choice => {
            if (choice === 'all' || choice === 'errors') {
              diagnostics.setFilter({ kind: choice });
              return;
            }
            const category = diagnostics.categories.find(known => `category:${known}` === choice);
            if (category !== undefined) {
              diagnostics.setFilter({ kind: 'category', category });
            }
          }}
        />
        <SelectRow
          testID="diagnostics-journal-days"
          title={texts.diagnostics.journal}
          options={JOURNAL_TERMS.map(days => ({
            value: days,
            label: texts.diagnostics.journalDays(days),
            testID: `journal-days-${days}`,
          }))}
          value={app.device.preferences.journalDays}
          onChange={days => app.device.setJournalDays(days)}
        />
      </Section>
      {diagnostics.shown.length === 0 ? (
        <Hint testID="diagnostics-empty" text={texts.diagnostics.empty} />
      ) : null}
      <Section>
        {diagnostics.shown.map(entry => {
          const local = entry.at.toZonedDateTimeISO(zone);
          const fields = Object.entries(entry.fields)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ');
          return (
            <View
              key={`${entry.at.epochMilliseconds}-${entry.category}-${entry.event}-${JSON.stringify(entry.fields)}`}
              testID={`diagnostics-entry-${entry.level}`}
              style={[styles.entry, { borderBottomColor: palette.lineSoft }]}
            >
              <Text
                style={[
                  styles.line,
                  {
                    color:
                      entry.level === 'error'
                        ? palette.danger
                        : entry.level === 'warn'
                          ? palette.caution
                          : palette.fg,
                  },
                ]}
              >
                {texts.format.time(local.hour, local.minute)} {entry.category} {entry.event}
              </Text>
              {fields === '' ? null : (
                <Text style={[styles.fields, { color: palette.fgDim }]}>{fields}</Text>
              )}
            </View>
          );
        })}
      </Section>
    </Screen>
  );
});

const styles = StyleSheet.create({
  entry: {
    paddingHorizontal: GUTTER,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  line: { fontFamily: 'monospace', fontSize: TEXT_SIZE.small },
  fields: { fontFamily: 'monospace', fontSize: TEXT_SIZE.caption },
});
