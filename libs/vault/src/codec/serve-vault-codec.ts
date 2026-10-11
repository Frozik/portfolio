import type { TResult } from '@frozik/utils/result/result';
import type { IRpcScope } from '@frozik/utils/worker/rpc-server';
import { serveRpc } from '@frozik/utils/worker/rpc-server';

import type { TBytes } from '../crypto/bytes';
import type { TSlotSecret } from '../format/keyslot-changes';
import { slotSecretBytes } from '../format/keyslot-changes';
import type { TManifest } from '../format/manifest';
import type { TUnlock } from '../format/open-vault';
import { unlockSecretOf } from '../format/open-vault';
import type { ISealContext } from '../format/seal-vault';
import type { IVaultKeys } from '../format/vault-keys';
import type { IVaultDocument } from '../model/vault-document';
import { createInThreadCodec } from './in-thread-codec';
import type { IOpenedVault, TCodecError } from './vault-codec';

export type TVaultCodecContract = {
  readonly createKeys: {
    readonly request: { readonly password: TBytes };
    readonly response: TResult<IVaultKeys, TCodecError>;
  };
  readonly changePassword: {
    readonly request: {
      readonly keys: IVaultKeys;
      readonly current: TSlotSecret;
      readonly next: TBytes;
    };
    readonly response: TResult<IVaultKeys, TCodecError>;
  };
  readonly rotateKey: {
    readonly request: { readonly keys: IVaultKeys; readonly password: TBytes };
    readonly response: TResult<IVaultKeys, TCodecError>;
  };
  readonly addPasskey: {
    readonly request: {
      readonly keys: IVaultKeys;
      readonly current: TSlotSecret;
      readonly credentialId: TBytes;
      readonly prfOutput: TBytes;
    };
    readonly response: TResult<IVaultKeys, TCodecError>;
  };
  readonly addRecoveryKey: {
    readonly request: {
      readonly keys: IVaultKeys;
      readonly current: TSlotSecret;
      readonly recoveryKey: TBytes;
    };
    readonly response: TResult<IVaultKeys, TCodecError>;
  };
  readonly open: {
    readonly request: { readonly file: TBytes; readonly unlock: TUnlock };
    readonly response: TResult<IOpenedVault, TCodecError>;
  };
  readonly seal: {
    readonly request: {
      readonly document: IVaultDocument;
      readonly manifest: TManifest;
      readonly context: ISealContext;
    };
    readonly response: TResult<TBytes, TCodecError>;
  };
};

/** The Worker half: the client sends the key with every call, the Worker keeps nothing. */
export function serveVaultCodec(
  scope: IRpcScope,
  dependencies: Parameters<typeof createInThreadCodec>[0]
): void {
  const codec = createInThreadCodec(dependencies);
  serveRpc<TVaultCodecContract>(scope, {
    createKeys: {
      handle: async ({ password }, signal) => {
        try {
          return await codec.createKeys(password, signal);
        } finally {
          password.fill(0);
        }
      },
    },
    changePassword: {
      handle: async ({ keys, current, next }, signal) => {
        try {
          return await codec.changePassword(keys, { current, next }, signal);
        } finally {
          slotSecretBytes(current).fill(0);
          next.fill(0);
        }
      },
    },
    rotateKey: {
      handle: async ({ keys, password }, signal) => {
        try {
          return await codec.rotateKey(keys, password, signal);
        } finally {
          password.fill(0);
        }
      },
    },
    addPasskey: {
      handle: async ({ keys, current, credentialId, prfOutput }, signal) => {
        try {
          return await codec.addPasskey(keys, { current, credentialId, prfOutput }, signal);
        } finally {
          slotSecretBytes(current).fill(0);
          prfOutput.fill(0);
        }
      },
    },
    addRecoveryKey: {
      handle: async ({ keys, current, recoveryKey }, signal) => {
        try {
          return await codec.addRecoveryKey(keys, { current, recoveryKey }, signal);
        } finally {
          slotSecretBytes(current).fill(0);
          recoveryKey.fill(0);
        }
      },
    },
    open: {
      handle: async ({ file, unlock }, signal) => {
        try {
          return await codec.open(file, unlock, signal);
        } finally {
          unlockSecretOf(unlock)?.fill(0);
        }
      },
    },
    seal: {
      handle: ({ document, manifest, context }, signal) =>
        codec.seal(document, manifest, context, signal),
      transfer: sealed => (sealed.ok ? [sealed.value.buffer] : []),
    },
  });
}
