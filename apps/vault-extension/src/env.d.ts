interface ImportMetaEnv {
  /** Set by the build from `infra/hosts/<name>.env`; empty when the host declares none. */
  readonly VITE_GOOGLE_VAULT_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
