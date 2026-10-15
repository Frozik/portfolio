import { nodeKdbxArgon2 } from '@frozik/vault/import/kdbx/adapters/kdbx-argon2-node';
import { readKdbx } from '@frozik/vault/import/kdbx/read-kdbx';
import { argon2 } from 'react-native-quick-crypto';

import type { TReadKdbx } from '@frozik/vault-app/interchange/domain/ports/kdbx-reader';

/** A KeePass database read on the JS thread; its Argon2 runs natively, so the screen keeps drawing. */
export const readKdbxOnPhone: TReadKdbx = (file, credentials) =>
  readKdbx(file, credentials, nodeKdbxArgon2(argon2));
