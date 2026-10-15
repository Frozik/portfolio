import { createRequire } from 'node:module';

interface IPathCondition {
  readonly path?: string;
  readonly pathNot?: string | readonly string[];
  readonly dependencyTypesNot?: readonly string[];
}

interface IRule {
  readonly name: string;
  readonly from: IPathCondition;
  readonly to: IPathCondition;
}

const { forbidden } = createRequire(import.meta.url)('../dependency-cruiser.cjs') as {
  readonly forbidden: readonly IRule[];
};

const GROUP_REFERENCE = /\$(\d)/g;

function anyOf(patterns: string | readonly string[] | undefined): readonly string[] {
  if (patterns === undefined) {
    return [];
  }
  return typeof patterns === 'string' ? [patterns] : patterns;
}

/** dependency-cruiser's matching of one rule: `$n` in `to` names a group of the `from` match. */
function violates(rule: IRule, from: string, to: string, typeOnly: boolean): boolean {
  const fromMatch = new RegExp(rule.from.path ?? '').exec(from);
  if (
    fromMatch === null ||
    anyOf(rule.from.pathNot).some(pattern => new RegExp(pattern).test(from))
  ) {
    return false;
  }
  const bound = (pattern: string): RegExp =>
    new RegExp(
      pattern.replace(GROUP_REFERENCE, (_whole, index: string) => fromMatch[Number(index)] ?? '')
    );
  if (typeOnly && rule.to.dependencyTypesNot?.includes('type-only') === true) {
    return false;
  }
  return (
    bound(rule.to.path ?? '').test(to) &&
    !anyOf(rule.to.pathNot).some(pattern => bound(pattern).test(to))
  );
}

function ruleNamed(name: string): IRule {
  const rule = forbidden.find(candidate => candidate.name === name);
  if (rule === undefined) {
    throw new Error(`No rule ${name}`);
  }
  return rule;
}

const APP = 'libs/vault-app/src';
const MOBX = 'node_modules/.pnpm/mobx@7.0.0/node_modules/mobx/dist/mobx.esm.js';

describe('the vault application layer rules', () => {
  it.each([
    [
      'vault-core-does-not-import-vault-app',
      'libs/vault/src/session/x.ts',
      `${APP}/session/domain/lock.ts`,
    ],
    [
      'vault-app-is-framework-free',
      `${APP}/device/application/Appearance.ts`,
      'node_modules/.pnpm/react@19.2.0/node_modules/react/index.js',
    ],
    [
      'vault-app-is-framework-free',
      `${APP}/device/domain/theme.ts`,
      'libs/components/src/ui/Button.tsx',
    ],
    [
      'vault-app-sees-no-platform-adapters',
      `${APP}/sync/application/x.ts`,
      'libs/vault/src/persistence/indexeddb/device-stores.ts',
    ],
    [
      'vault-native-uses-no-browser-adapters',
      'apps/vault-native/src/infrastructure/x.ts',
      'libs/vault/src/crypto/adapters/kdf-hash-wasm.ts',
    ],
    [
      'vault-native-uses-no-browser-adapters',
      'apps/vault-native/src/infrastructure/x.ts',
      'libs/vault-browser/src/session/browser-session-clock.ts',
    ],
    [
      'vault-http-runs-everywhere',
      'libs/vault-http/src/cloud/cloud-connection.ts',
      'libs/vault-browser/src/cloud/google-drive-auth.ts',
    ],
    [
      'vault-native-keeps-secrets-out-of-the-settings-store',
      'apps/vault-native/src/infrastructure/device-unlock.ts',
      'node_modules/.pnpm/expo-sqlite@57.0.4/node_modules/expo-sqlite/kv-store.js',
    ],
    [
      'vault-application-does-not-import-infrastructure',
      `${APP}/cloud/application/CloudLink.ts`,
      `${APP}/cloud/infrastructure/codec.ts`,
    ],
    [
      'vault-application-does-not-import-infrastructure',
      'libs/vault-browser/src/keys/application/x.ts',
      'libs/vault-browser/src/infrastructure/webauthn.ts',
    ],
    [
      'vault-app-domain-stays-in-its-context',
      `${APP}/keys/domain/quick-code.ts`,
      `${APP}/session/domain/lock.ts`,
    ],
    [
      'vault-app-domain-stays-in-its-context',
      `${APP}/keys/domain/quick-code.ts`,
      `${APP}/keys/application/SessionKeys.ts`,
    ],
    [
      'vault-app-contexts-meet-in-the-session',
      `${APP}/cloud/application/CloudLink.ts`,
      `${APP}/sync/application/SyncController.ts`,
    ],
    [
      'vault-app-application-does-not-import-texts',
      `${APP}/keys/application/SessionKeys.ts`,
      `${APP}/texts/keys/en.ts`,
    ],
    [
      'vault-renderer-holds-no-logic',
      'apps/vault-web/src/screens/Unlock.tsx',
      `${APP}/keys/domain/quick-code.ts`,
    ],
    [
      'vault-renderer-reads-only-core-types',
      'apps/vault-native/src/app/index.tsx',
      'libs/vault/src/model/card.ts',
    ],
    [
      'vault-renderer-reaches-no-adapter',
      'apps/vault-web/src/screens/Unlock.tsx',
      'apps/vault-web/src/infrastructure/theme-store.ts',
    ],
    [
      'vault-renderer-reaches-no-adapter',
      'apps/vault-web/src/screens/Unlock.tsx',
      'libs/vault-browser/src/keys/webauthn.ts',
    ],
  ])('%s catches %s → %s', (name, from, to) => {
    expect(violates(ruleNamed(name), from, to, false)).toBe(true);
  });

  it.each([
    ['vault-app-is-framework-free', `${APP}/device/application/Appearance.ts`, MOBX, false],
    [
      'vault-app-domain-stays-in-its-context',
      `${APP}/keys/domain/quick-code.ts`,
      `${APP}/keys/domain/pattern-code.ts`,
      false,
    ],
    [
      'vault-app-domain-stays-in-its-context',
      `${APP}/keys/domain/quick-code.ts`,
      `${APP}/navigation/vault-pages.ts`,
      false,
    ],
    [
      'vault-app-contexts-meet-in-the-session',
      `${APP}/session/application/SessionComposition.ts`,
      `${APP}/sync/application/SyncController.ts`,
      false,
    ],
    [
      'vault-app-contexts-meet-in-the-session',
      `${APP}/cloud/application/CloudLink.ts`,
      `${APP}/cloud/application/CloudSetup.ts`,
      false,
    ],
    [
      'vault-app-contexts-meet-in-the-session',
      `${APP}/cloud/application/CloudLink.ts`,
      `${APP}/sync/domain/x.ts`,
      false,
    ],
    [
      'vault-renderer-holds-no-logic',
      'apps/vault-web/src/screens/Unlock.tsx',
      `${APP}/keys/application/SessionKeys.ts`,
      false,
    ],
    [
      'vault-renderer-holds-no-logic',
      'apps/vault-web/src/screens/Unlock.tsx',
      `${APP}/texts/keys/en.ts`,
      false,
    ],
    [
      'vault-renderer-reads-only-core-types',
      'apps/vault-native/src/app/index.tsx',
      'libs/vault/src/model/card.ts',
      true,
    ],
    [
      'vault-native-uses-no-browser-adapters',
      'apps/vault-native/src/infrastructure/kdf-quick-crypto.ts',
      'libs/vault/src/crypto/adapters/kdf-node-argon2.ts',
      false,
    ],
    [
      'vault-native-keeps-secrets-out-of-the-settings-store',
      'apps/vault-native/src/infrastructure/runtime-reload-wipe.ts',
      'node_modules/.pnpm/expo-sqlite@57.0.4/node_modules/expo-sqlite/kv-store.js',
      false,
    ],
  ] as const)('%s allows %s → %s', (name, from, to, typeOnly) => {
    expect(violates(ruleNamed(name), from, to, typeOnly)).toBe(false);
  });
});
