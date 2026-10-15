import { createIndexedDbProvider } from '@frozik/cloud-storage/indexeddb/indexeddb-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { HASH_WASM_KDF } from '@frozik/vault/crypto/adapters/kdf-hash-wasm';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import { ExtensionSession } from '../application/ExtensionSession';
import { handleRequest } from '../application/handle-request';
import type { TRequest } from '../domain/messages';
import {
  CHROME_DEVICE_CONFIG,
  CHROME_PENDING_CLOUD_LINK,
  CHROME_SYNC_ALARM,
  openWebDav,
  SYNC_ALARM,
} from '../infrastructure/cloud-stores';
import { CHROME_GOOGLE_DRIVE } from '../infrastructure/google-drive-access';
import { CHROME_IDLE_ALARM, IDLE_ALARM } from '../infrastructure/idle-alarm';
import { OFFSCREEN_CLIPBOARD } from '../infrastructure/offscreen-clipboard';
import { CHROME_PAGE_FILLER } from '../infrastructure/page-filler';
import {
  CHROME_LAST_MASTER,
  CHROME_QUICK_EXPIRY,
  CHROME_QUICK_LOCKS,
  QUICK_EXPIRY_ALARM,
} from '../infrastructure/quick-lock-store';
import { CHROME_RESTART } from '../infrastructure/restart';
import {
  CHROME_PROTECTED_WINDOW,
  CHROME_SESSION_KEYS,
  closeSessionStoreToPages,
} from '../infrastructure/session-key-store';
import { CHROME_SETUP } from '../infrastructure/setup-store';
import { isTrustedSender } from '../infrastructure/trusted-sender';

const FILL_COMMAND = 'fill-login';

function isRequest(message: unknown): message is TRequest {
  return typeof message === 'object' && !isNil(message) && 'kind' in message;
}

/** The shortcut fills the page's first card, or opens the popup to unlock first. */
async function fillBest(session: ExtensionSession): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (isNil(tab?.id) || isNil(tab.url)) {
    return;
  }
  const status = await session.status();
  if (status.kind !== 'unlocked') {
    await browser.action.openPopup();
    return;
  }
  const [best] = await session.cards.pageCards(tab.url);
  if (!isNil(best)) {
    await session.cards.fill(best.id, tab.id, tab.url, false);
  }
}

/**
 * The service worker: the session, rebuilt at every wake
 * from the key in `storage.session`; requests only from the extension's own
 * pages; the idle alarm locks; the shortcut fills.
 */
export default defineBackground({
  type: 'module',
  main() {
    void closeSessionStoreToPages();
    const session = new ExtensionSession(
      {
        localCopyOf: vaultKey => createIndexedDbProvider(`pwv:extension:${vaultKey}`),
        sessionKeys: CHROME_SESSION_KEYS,
        setup: CHROME_SETUP,
        filler: CHROME_PAGE_FILLER,
        clipboard: OFFSCREEN_CLIPBOARD,
        restart: CHROME_RESTART,
        idleAlarm: CHROME_IDLE_ALARM,
        protectedWindow: CHROME_PROTECTED_WINDOW,
        quickLocks: CHROME_QUICK_LOCKS,
        lastMaster: CHROME_LAST_MASTER,
        quickExpiry: CHROME_QUICK_EXPIRY,
        openWebDav,
        deviceConfig: CHROME_DEVICE_CONFIG,
        pendingLink: CHROME_PENDING_CLOUD_LINK,
        googleDrive: CHROME_GOOGLE_DRIVE,
        syncAlarm: CHROME_SYNC_ALARM,
        random: WEB_RANDOM,
        now: () => Temporal.Now.instant().epochMilliseconds,
      },
      createInThreadCodec({
        argon2: HASH_WASM_KDF,
        random: WEB_RANDOM,
        elapsed: () => performance.now() as Milliseconds,
      }),
      HASH_WASM_KDF
    );
    browser.runtime.onMessage.addListener((message, sender, respond) => {
      if (!isTrustedSender(sender) || !isRequest(message)) {
        return false;
      }
      void handleRequest(session, message).then(respond);
      return true;
    });
    browser.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === IDLE_ALARM) {
        void session.lockQuickly();
      }
      if (alarm.name === QUICK_EXPIRY_ALARM) {
        void session.lock();
      }
      if (alarm.name === SYNC_ALARM) {
        void session.sync();
      }
    });
    browser.commands.onCommand.addListener(command => {
      if (command === FILL_COMMAND) {
        void fillBest(session);
      }
    });
  },
});
