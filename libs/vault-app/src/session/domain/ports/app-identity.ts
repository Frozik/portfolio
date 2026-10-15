import type { ICxfExporter } from '@frozik/vault/export/cxf/export-cxf';

/** Which client this is, as the files it makes say. */
export interface IAppIdentity {
  /** In the manifest of a file this client writes first: a new vault, an encrypted export. */
  readonly createdBy: string;
  /** The host the vault runs on and its name, written into a CXF export. */
  readonly exporter: Omit<ICxfExporter, 'accountId'>;
}
