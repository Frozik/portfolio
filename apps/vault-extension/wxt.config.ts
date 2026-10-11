import { isNil } from 'lodash-es';
import { defineConfig } from 'wxt';

/**
 * The e2e build only: Playwright cannot click the toolbar icon, so the test
 * domain is granted up front instead of through `activeTab`.
 */
const E2E_HOSTS = ['https://*.example.test/*'];

/** Chrome takes one to four dotted integers: the release's version, stamped by CI, without a pre-release tail. */
const RELEASE_VERSION = /^\d+\.\d+\.\d+/.exec(process.env.VAULT_EXTENSION_VERSION ?? '')?.[0];

/** The manifest: no content scripts, no `<all_urls>`, `tabs` and site hosts only on request. */
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  zip: { artifactTemplate: 'password-vault-{{version}}-{{browser}}.zip' },
  manifest: ({ mode }) => ({
    name: 'Password Vault',
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
