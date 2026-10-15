import type { TGeneratorMode } from '@frozik/vault/generator/generate';
import type { TPassphraseSeparator } from '@frozik/vault/generator/passphrase';
import type { TBuiltinIcon, TBuiltinIconGroup } from '@frozik/vault/model/builtin-icons';
import type { TCardColor } from '@frozik/vault/model/card';
import type { TCardNetwork } from '@frozik/vault/model/card-network';

/** The strings of the vault's own React components, for the language of the page. */
export interface IWidgetTexts {
  readonly generator: {
    readonly title: string;
    readonly mode: string;
    readonly modes: Readonly<Record<TGeneratorMode, string>>;
    readonly siteRules: (domain: string) => string;
    readonly siteRulesBroken: string;
    readonly length: string;
    readonly words: string;
    readonly upper: string;
    readonly lower: string;
    readonly digits: string;
    readonly symbols: string;
    readonly excludeSimilar: string;
    readonly separator: string;
    readonly separators: Readonly<Record<TPassphraseSeparator, string>>;
    readonly capitalize: string;
    readonly includeDigit: string;
    readonly entropy: (bits: number) => string;
    readonly regenerate: string;
    readonly use: string;
    readonly noCharacters: string;
  };
  readonly showToEdit: string;
  readonly networks: Readonly<Record<TCardNetwork, string>>;
  readonly appearance: {
    readonly color: string;
    readonly noColor: string;
    readonly colors: Readonly<Record<TCardColor, string>>;
    readonly icon: string;
    readonly automatic: string;
    readonly icons: Readonly<Record<TBuiltinIcon, string>>;
    readonly iconGroups: Readonly<Record<TBuiltinIconGroup, string>>;
  };
  /** The marked first number of a password rotation's list. */
  readonly passwordInUse: string;
  readonly pinPad: {
    readonly label: string;
    readonly entered: (count: number, length: number) => string;
    readonly erase: string;
  };
  readonly patternPad: {
    readonly label: string;
    readonly point: (row: number, column: number) => string;
    readonly hint: string;
  };
  readonly totp: {
    readonly label: string;
    readonly copy: string;
    readonly secondsLeft: (seconds: number) => string;
    readonly unreadable: string;
    /** A counter-based code is used once: the next one is asked for. */
    readonly next: string;
  };
}
