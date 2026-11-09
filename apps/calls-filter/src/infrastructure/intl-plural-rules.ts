// Hermes on Android has no Intl.PluralRules; the polyfill installs itself only when it is missing,
// and the locale data joins only that polyfill: one entry per language the app speaks.
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/ru.js';
