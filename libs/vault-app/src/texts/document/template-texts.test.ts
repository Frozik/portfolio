import { utf8 } from '@frozik/vault/crypto/bytes';
import type { TImportLabel } from '@frozik/vault/import/imported-card';
import { readImportFile } from '@frozik/vault/import/read-import-file';
import { BUILTIN_TEMPLATES } from '@frozik/vault/model/templates/registry';
import {
  BITWARDEN_CSV,
  BITWARDEN_JSON,
  CHROME_CSV,
  FIREFOX_CSV,
  SAFARI_CSV,
  SAFEINCLOUD_XML,
} from '@frozik/vault/testing/import-fixtures';

import { templateTextsEn } from './template-texts-en';
import { templateTextsRu } from './template-texts-ru';

function templateKeys(): readonly string[] {
  return BUILTIN_TEMPLATES.flatMap(template => [
    template.nameKey,
    ...template.tabs.flatMap(tab => [
      ...(tab.titleKey === null ? [] : [tab.titleKey]),
      ...tab.fields.flatMap(field => [
        field.labelKey,
        ...(field.spec?.kind === 'select' ? field.spec.options : []),
      ]),
    ]),
  ]);
}

/** The labels importers give fields beyond the templates' own. */
function importKeys(): readonly string[] {
  return [
    BITWARDEN_JSON,
    BITWARDEN_CSV,
    CHROME_CSV,
    FIREFOX_CSV,
    SAFARI_CSV,
    SAFEINCLOUD_XML,
  ].flatMap(text => {
    const read = readImportFile(utf8(text));
    const cards = read.ok && read.value.kind === 'entries' ? read.value.batch.cards : [];
    return cards.flatMap(card =>
      card.tabs
        .flatMap(tab => tab.fields.map(field => field.label))
        .flatMap((label: TImportLabel) => (label.kind === 'key' ? [label.key] : []))
    );
  });
}

describe('template texts', () => {
  it('name every template, tab, field and option in English and Russian', () => {
    const missing = templateKeys().filter(
      key => templateTextsEn[key] === undefined || templateTextsRu[key] === undefined
    );

    expect(missing).toEqual([]);
  });

  it('name the fields an import adds', () => {
    expect(importKeys().filter(key => templateTextsEn[key] === undefined)).toEqual([]);
  });

  it('has the same keys in both languages, those of the demo vault included', () => {
    expect(Object.keys(templateTextsRu).sort()).toEqual(Object.keys(templateTextsEn).sort());
  });
});
