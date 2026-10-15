import { retireEveryCopy } from './kill-switch';
import { installVaultWorker } from './vault-worker';

declare let self: ServiceWorkerGlobalScope;

if (__KILL_SWITCH__) {
  retireEveryCopy(self);
} else {
  installVaultWorker(self, self.__WB_MANIFEST);
}
