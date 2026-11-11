import { setStringAsync } from 'expo-clipboard';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { TDiagnosticsFilter } from '@frozik/vault-app/diagnostics/application/DiagnosticsModel';
import type { IDiagnosticsEntry } from '@frozik/vault-app/diagnostics/domain/diagnostics-entry';
import {
  DIAGNOSTICS_TERMS,
  diagnosticsTermOf,
} from '@frozik/vault-app/diagnostics/domain/diagnostics-terms';

import { useAppModel } from '../app-model';
import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE } from '../kit/metrics';
import { Select } from '../kit/Select';
import { useLanguage, useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

function filterKey(filter: TDiagnosticsFilter): string {
  return filter.kind === 'category' ? filter.category : filter.kind;
}

function platformLine(): string {
  if (Platform.OS !== 'android') {
    return `${Platform.OS} ${Platform.Version}`;
  }
  const { Release, Manufacturer, Model } = Platform.constants;
  return `Android ${Release} (API ${Platform.Version}) · ${Manufacturer} ${Model}`;
}

const Entry = function Entry({ entry }: { readonly entry: IDiagnosticsEntry }) {
  const palette = usePalette();
  const language = useLanguage();
  const fields = Object.entries(entry.fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  const color =
    entry.level === 'error'
      ? palette.danger
      : entry.level === 'warn'
        ? palette.caution
        : palette.fg;
  const at = new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'medium' }).format(
    entry.at.epochMilliseconds
  );
  return (
    <View
      testID={`diagnostics-entry-${entry.level}`}
      style={[styles.entry, { borderBottomColor: palette.lineSoft }]}
    >
      <Text style={[styles.line, { color }]}>
        {at} {entry.category} {entry.event}
      </Text>
      {fields !== '' && <Text style={[styles.fields, { color: palette.fgDim }]}>{fields}</Text>}
    </View>
  );
};

/** The device's log: through a filter, kept for a chosen term, copied whole as the filter shows it. */
export const DiagnosticsSection = observer(function DiagnosticsSection() {
  const { version, diagnostics } = useAppModel();
  const palette = usePalette();
  const t = useSettingsTexts().diagnostics;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    diagnostics.refresh();
  }, [diagnostics]);
  const filters: readonly {
    readonly value: string;
    readonly label: string;
    readonly filter: TDiagnosticsFilter;
  }[] = [
    { value: 'all', label: t.all, filter: { kind: 'all' } },
    { value: 'problems', label: t.problems, filter: { kind: 'problems' } },
    ...diagnostics.categories.map(category => ({
      value: category,
      label: t.categories[category],
      filter: { kind: 'category', category } as const,
    })),
  ];
  const copy = (): void => {
    void setStringAsync(
      diagnostics.copyText({ app: `Ciphra Vault ${version}`, platform: platformLine() })
    ).then(setCopied);
  };
  return (
    <>
      <Select
        testID="diagnostics-term"
        label={t.term}
        options={DIAGNOSTICS_TERMS.map(days => ({ value: String(days), label: t.termDays(days) }))}
        value={String(diagnostics.term)}
        onChange={value => {
          const term = diagnosticsTermOf(Number(value));
          if (term !== null) {
            diagnostics.setTerm(term);
          }
        }}
      />
      <Select
        testID="diagnostics-filter"
        label={t.shown}
        options={filters}
        value={filterKey(diagnostics.filter)}
        onChange={value => {
          const chosen = filters.find(option => option.value === value);
          if (chosen !== undefined) {
            diagnostics.setFilter(chosen.filter);
          }
        }}
      />
      <Button
        testID="diagnostics-copy"
        variant="secondary"
        icon={copied ? 'check' : 'content-copy'}
        label={copied ? t.copied : t.copy}
        disabled={diagnostics.shown.length === 0}
        onPress={copy}
      />
      {diagnostics.shown.length === 0 ? (
        <Text testID="diagnostics-empty" style={[styles.empty, { color: palette.fgFaint }]}>
          {t.empty}
        </Text>
      ) : (
        <View testID="diagnostics-entries">
          {diagnostics.shown.map(entry => (
            <Entry
              key={`${entry.at.epochMilliseconds}-${entry.category}-${entry.event}-${JSON.stringify(entry.fields)}`}
              entry={entry}
            />
          ))}
        </View>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  empty: { fontSize: TEXT_SIZE.small },
  entry: { paddingVertical: GAP / 2, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { fontFamily: 'monospace', fontSize: TEXT_SIZE.small },
  fields: { fontFamily: 'monospace', fontSize: TEXT_SIZE.caption },
});
