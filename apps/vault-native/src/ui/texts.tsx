import type { Language } from '@frozik/utils/i18n/language';
import { DEFAULT_LANGUAGE } from '@frozik/utils/i18n/language';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { AUDIT_TEXTS } from '@frozik/vault-app/texts/audit/audit-texts';
import { CLOUD_TEXTS } from '@frozik/vault-app/texts/cloud/cloud-texts';
import { SETTINGS_TEXTS } from '@frozik/vault-app/texts/device/settings-texts';
import { EDITOR_TEXTS } from '@frozik/vault-app/texts/document/editor-texts';
import {
  TEMPLATE_TEXTS,
  templateKeyTranslator,
} from '@frozik/vault-app/texts/document/template-texts';
import { DATA_TEXTS } from '@frozik/vault-app/texts/interchange/data-texts';
import { KEYS_TEXTS } from '@frozik/vault-app/texts/keys/keys-texts';
import { VAULT_TEXTS } from '@frozik/vault-app/texts/vault/vault-texts';
import { WIDGET_TEXTS } from '@frozik/vault-app/texts/widgets/widgets-texts';

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

/** The phone's language for every screen below; the root layout reads it once. */
export function AppLanguage({
  language,
  children,
}: {
  readonly language: Language;
  readonly children: ReactNode;
}) {
  return <LanguageContext value={language}>{children}</LanguageContext>;
}

export function useLanguage(): Language {
  return useContext(LanguageContext);
}

/** One of the vault's text tables in the phone's language. */
export function useTexts<T>(table: Readonly<Record<Language, T>>): T {
  return table[useContext(LanguageContext)];
}

export function useVaultTexts() {
  return useTexts(VAULT_TEXTS);
}

export function useWidgetTexts() {
  return useTexts(WIDGET_TEXTS);
}

export function useKeysTexts() {
  return useTexts(KEYS_TEXTS);
}

export function useCloudTexts() {
  return useTexts(CLOUD_TEXTS);
}

export function useEditorTexts() {
  return useTexts(EDITOR_TEXTS);
}

/** Built-in templates' and their fields' names in the phone's language. */
export function useTemplateTranslator() {
  return templateKeyTranslator(useTexts(TEMPLATE_TEXTS));
}

export function useSettingsTexts() {
  return useTexts(SETTINGS_TEXTS);
}

export function useAuditTexts() {
  return useTexts(AUDIT_TEXTS);
}

export function useDataTexts() {
  return useTexts(DATA_TEXTS);
}
