import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isNil } from 'lodash-es';
import { defineConfig } from 'wxt';

/**
 * The e2e build only: Playwright cannot click the toolbar icon, so the test
 * domain is granted up front instead of through `activeTab`.
 */
const E2E_HOSTS = ['https://*.example.test/*'];

/** Chrome takes one to four dotted integers: the release's version, stamped by CI, without a pre-release tail. */
const RELEASE_VERSION = /^\d+\.\d+\.\d+/.exec(process.env.VAULT_EXTENSION_VERSION ?? '')?.[0];

/**
 * The public half of the extension's key: it fixes the extension's id, so the
 * address Google returns the sign-in to (`https://<id>.chromiumapp.org/`) is
 * the same on every install. The private half is not kept: nothing is packed
 * with it, an unpacked extension needs only this.
 */
const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx4v5NEGWgixC1QBWvTMr0VQgUBTZ102Sr0F9JGXGcRqFTGuzED5qICdd64AAlN5FZJyvD6XtVhYR1177enws0Wwy30wFmUR897htps+ZKPDjLAgXeZplnQB9gkkn+NjoTX5KOcXHBSm4sNrWYCnCnlcv2LA1dhzuEsCXBwqMKH1sfdeNfpsLIVOsiWzhG6PjE8aclSc4AvItJnAcfnxSE31BSEkl0d/dU6UnD/1GTL6Klvd4xKLXoW1O8mJO3/Ail+rBgpEaWal6zdh6g/bxAUZTY0ZzjGOWBKumjkrF5lb2eYTsGU2niHzVe3oZx74gTDfB9p+UJZdcE55YOWX4hwIDAQAB';

/** The vault's OAuth client, read from the same `infra/hosts/<name>.env` the web app's build reads. */
function vaultClientId(): string {
  const host = process.env.DEPLOY_HOST_NAME ?? 'production';
  const hostFile = readFileSync(
    resolve(import.meta.dirname, '..', '..', 'infra', 'hosts', `${host}.env`),
    'utf8'
  );
  return /^GOOGLE_VAULT_CLIENT_ID=(.*)$/m.exec(hostFile)?.[1]?.trim() ?? '';
}

/** The manifest: no content scripts, no `<all_urls>`, `tabs` and site hosts only on request. */
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // The shared controls name their CSS classes in kebab case and read them in camel case, as the web app's build does.
  vite: () => ({
    css: { modules: { localsConvention: 'camelCaseOnly' } },
    define: { 'import.meta.env.VITE_GOOGLE_VAULT_CLIENT_ID': JSON.stringify(vaultClientId()) },
  }),
  zip: { artifactTemplate: 'password-vault-{{version}}-{{browser}}.zip' },
  manifest: ({ mode }) => ({
    name: 'Password Vault',
    key: EXTENSION_KEY,
    ...(isNil(RELEASE_VERSION) ? {} : { version: RELEASE_VERSION }),
    description: 'Fills saved logins from a vault file kept in your own cloud.',
    permissions: [
      'storage',
      'unlimitedStorage',
      'activeTab',
      'scripting',
      'identity',
      'alarms',
      'offscreen',
      'clipboardWrite',
    ],
    optional_permissions: ['tabs'],
    host_permissions: ['https://www.googleapis.com/*', ...(mode === 'e2e' ? E2E_HOSTS : [])],
    optional_host_permissions: ['https://*/*'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    commands: {
      'fill-login': {
        suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
        description: 'Fill the best login for this page',
      },
    },
  }),
});
