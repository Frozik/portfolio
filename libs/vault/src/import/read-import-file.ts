import { parseCsv } from '@frozik/utils/csv/csv';
import { parseJson } from '@frozik/utils/parseJson';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { utf8Text } from '../crypto/bytes';
import { BLOB_EXTENSION, BLOB_FOLDER } from '../format/blob-file';
import { IMPORT_ARCHIVE_MAX_BYTES, unpackContainer } from '../format/container';
import {
  COPY_VAULT_PATH,
  CXF_DOCUMENTS,
  CXF_PATH,
  startsWithZipMagic,
} from '../format/export-archives';
import { startsWithVaultMagic } from '../format/header';
import { parseOtpMigration } from '../otp/otp-migration';
import { importBitwardenCsv } from './bitwarden-csv/bitwarden-csv';
import {
  BITWARDEN_ENCRYPTED_SCHEMA,
  BITWARDEN_EXPORT_SCHEMA,
} from './bitwarden-json/bitwarden-schema';
import { importBitwardenJson } from './bitwarden-json/map-bitwarden';
import { importBrowserCsv } from './browser-csv/browser-csv';
import { CXF_HEADER_SCHEMA } from './cxf/cxf-schema';
import { importCxf } from './cxf/map-cxf';
import type { IImportBatch } from './imported-card';
import { startsWithKdbxMagic } from './kdbx/kdbx-magic';
import { importOtpMigration } from './otp-migration/import-otp-migration';
import { importSafeInCloud } from './safeincloud/map-safeincloud';
import { parseSafeInCloud } from './safeincloud/parse-safeincloud';

export type TImportFile =
  | { readonly kind: 'entries'; readonly batch: IImportBatch }
  /**
   * Another vault: it opens with its own password before its cards are known;
   * a copy with big files brings them sealed, by asset id.
   */
  | {
      readonly kind: 'vault-file';
      readonly vault: TBytes;
      readonly sealedBlobs: ReadonlyMap<string, TBytes>;
    }
  /** A KeePass database: the same, its key derived in a Worker. */
  | { readonly kind: 'kdbx-file' };

export type TImportFileError = 'unrecognized' | 'encrypted-export';

function jsonBatch(
  text: string,
  files: ReadonlyMap<string, TBytes> = new Map()
): TResult<IImportBatch, TImportFileError> {
  const json = parseJson<unknown>(text);
  if (BITWARDEN_ENCRYPTED_SCHEMA.safeParse(json).success) {
    return err('encrypted-export');
  }
  const cxf = CXF_HEADER_SCHEMA.safeParse(json);
  if (cxf.success) {
    return ok(importCxf(cxf.data, files));
  }
  const parsed = BITWARDEN_EXPORT_SCHEMA.safeParse(json);
  return parsed.success ? ok(importBitwardenJson(parsed.data)) : err('unrecognized');
}

/** A CXF archive: `cxf.json` and each file under `documents/<its id>`. */
function filesUnder(
  entries: ReadonlyMap<string, TBytes>,
  folder: string,
  extension = ''
): ReadonlyMap<string, TBytes> {
  return new Map(
    [...entries]
      .filter(([path]) => path.startsWith(folder) && path.endsWith(extension))
      .map(([path, file]) => [path.slice(folder.length, path.length - extension.length), file])
  );
}

/** A zip is an encrypted copy with its big files, or a CXF archive. */
function zipFile(bytes: TBytes): TResult<TImportFile, TImportFileError> {
  const entries = unpackContainer(bytes, IMPORT_ARCHIVE_MAX_BYTES);
  if (!entries.ok) {
    return err('unrecognized');
  }
  const vault = entries.value.get(COPY_VAULT_PATH);
  if (!isNil(vault) && startsWithVaultMagic(vault)) {
    const sealedBlobs = filesUnder(entries.value, `${BLOB_FOLDER}/`, BLOB_EXTENSION);
    return ok({ kind: 'vault-file', vault, sealedBlobs });
  }
  const header = entries.value.get(CXF_PATH);
  const text = isNil(header) ? null : utf8Text(header);
  if (isNil(text)) {
    return err('unrecognized');
  }
  const batch = jsonBatch(text, filesUnder(entries.value, CXF_DOCUMENTS));
  return batch.ok ? ok({ kind: 'entries', batch: batch.value }) : batch;
}

function xmlBatch(text: string): TResult<IImportBatch, TImportFileError> {
  const database = parseSafeInCloud(text);
  return isNil(database) ? err('unrecognized') : ok(importSafeInCloud(database));
}

function csvBatch(text: string): TResult<IImportBatch, TImportFileError> {
  const rows = parseCsv(text.replaceAll('\r\n', '\n'));
  const batch = importBrowserCsv(rows) ?? importBitwardenCsv(rows);
  return isNil(batch) ? err('unrecognized') : ok(batch);
}

/**
 * What a chosen file is, told by its content rather than
 * its name: a vault and a KeePass file by their magic, a CXF archive by the zip's, Google Authenticator's transfer by its
 * scheme, JSON and XML by the first character, the CSV dialect by its header.
 */
export function readImportFile(bytes: TBytes): TResult<TImportFile, TImportFileError> {
  if (startsWithVaultMagic(bytes)) {
    return ok({ kind: 'vault-file', vault: bytes, sealedBlobs: new Map() });
  }
  if (startsWithKdbxMagic(bytes)) {
    return ok({ kind: 'kdbx-file' });
  }
  if (startsWithZipMagic(bytes)) {
    return zipFile(bytes);
  }
  const text = utf8Text(bytes);
  if (isNil(text)) {
    return err('unrecognized');
  }
  const start = text.trimStart();
  const migration = parseOtpMigration(start);
  if (migration.ok) {
    return ok({ kind: 'entries', batch: importOtpMigration(migration.value) });
  }
  const batch = start.startsWith('{')
    ? jsonBatch(text)
    : start.startsWith('<')
      ? xmlBatch(text)
      : csvBatch(text);
  return batch.ok ? ok({ kind: 'entries', batch: batch.value }) : batch;
}
