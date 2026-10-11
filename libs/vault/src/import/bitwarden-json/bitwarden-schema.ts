import { z } from 'zod';

const text = z.string().nullish();

const URI_SCHEMA = z.looseObject({ uri: text, match: z.int().nullish() });

const FIELD_SCHEMA = z.looseObject({ name: text, value: text, type: z.int() });

const LOGIN_SCHEMA = z.looseObject({
  uris: z.array(URI_SCHEMA).nullish(),
  username: text,
  password: text,
  totp: text,
  fido2Credentials: z.array(z.unknown()).nullish(),
});

const CARD_SCHEMA = z.looseObject({
  cardholderName: text,
  number: text,
  expMonth: text,
  expYear: text,
  code: text,
});

const IDENTITY_SCHEMA = z.looseObject({
  title: text,
  firstName: text,
  middleName: text,
  lastName: text,
  address1: text,
  address2: text,
  address3: text,
  city: text,
  state: text,
  postalCode: text,
  country: text,
  company: text,
  email: text,
  phone: text,
  ssn: text,
  username: text,
  passportNumber: text,
  licenseNumber: text,
});

const SSH_KEY_SCHEMA = z.looseObject({ privateKey: text, publicKey: text, keyFingerprint: text });

export const BITWARDEN_ITEM_SCHEMA = z.looseObject({
  type: z.int(),
  name: text,
  notes: text,
  favorite: z.boolean().nullish(),
  reprompt: z.int().nullish(),
  folderId: text,
  collectionIds: z.array(z.string()).nullish(),
  fields: z.array(FIELD_SCHEMA).nullish(),
  login: LOGIN_SCHEMA.nullish(),
  card: CARD_SCHEMA.nullish(),
  identity: IDENTITY_SCHEMA.nullish(),
  sshKey: SSH_KEY_SCHEMA.nullish(),
  creationDate: z.iso.datetime({ offset: true }).nullish().catch(null),
  deletedDate: text,
  archivedDate: text,
});

const NAMED_SCHEMA = z.looseObject({ id: z.string(), name: z.string() });

/** Bitwarden's unencrypted JSON export, personal or of an organisation. */
export const BITWARDEN_EXPORT_SCHEMA = z.looseObject({
  encrypted: z.literal(false).optional(),
  folders: z.array(NAMED_SCHEMA).nullish(),
  collections: z.array(NAMED_SCHEMA).nullish(),
  items: z.array(BITWARDEN_ITEM_SCHEMA),
});

/** A password-protected or account-encrypted export: only Bitwarden can read it. */
export const BITWARDEN_ENCRYPTED_SCHEMA = z.looseObject({ encrypted: z.literal(true) });

export type TBitwardenItem = z.infer<typeof BITWARDEN_ITEM_SCHEMA>;
export type TBitwardenExport = z.infer<typeof BITWARDEN_EXPORT_SCHEMA>;
