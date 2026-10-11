import type { TGeneratorMode } from '../../generator/generate';
import type { TPassphraseSeparator } from '../../generator/passphrase';
import type { TBuiltinIcon, TBuiltinIconGroup } from '../../model/builtin-icons';
import type { TCardColor } from '../../model/card';
import type { TCardNetwork } from '../../model/card-network';

/** The strings of the vault's own React components, for the language of the page. */
export interface IVaultReactTranslations {
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
  readonly totp: {
    readonly label: string;
    readonly copy: string;
    readonly secondsLeft: (seconds: number) => string;
    readonly unreadable: string;
  };
}
