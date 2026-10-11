import { z } from 'zod';

/** FIDO Credential Exchange Format 1.0: what the importer reads, every part optional it may be. */
const EDITABLE_FIELD = z.object({
  id: z.string().optional(),
  fieldType: z.string(),
  value: z.string(),
  label: z.string().optional(),
});

export type TCxfField = z.infer<typeof EDITABLE_FIELD>;

const OPTIONAL_FIELD = EDITABLE_FIELD.optional();

const LINKED_ITEM = z.object({ item: z.string(), account: z.string().optional() });

const CREDENTIAL = z.discriminatedUnion('type', [
  z.object({ type: z.literal('basic-auth'), username: OPTIONAL_FIELD, password: OPTIONAL_FIELD }),
  z.object({
    type: z.literal('totp'),
    secret: z.string(),
    period: z.int().positive().optional(),
    digits: z.int().positive().optional(),
    username: z.string().optional(),
    algorithm: z.string().optional(),
    issuer: z.string().optional(),
  }),
  z.object({ type: z.literal('note'), content: EDITABLE_FIELD }),
  z.object({
    type: z.literal('credit-card'),
    number: OPTIONAL_FIELD,
    fullName: OPTIONAL_FIELD,
    cardType: OPTIONAL_FIELD,
    verificationNumber: OPTIONAL_FIELD,
    pin: OPTIONAL_FIELD,
    expiryDate: OPTIONAL_FIELD,
    validFrom: OPTIONAL_FIELD,
  }),
  z.object({
    type: z.literal('wifi'),
    ssid: OPTIONAL_FIELD,
    networkSecurityType: OPTIONAL_FIELD,
    passphrase: OPTIONAL_FIELD,
    hidden: OPTIONAL_FIELD,
  }),
  z.object({
    type: z.literal('ssh-key'),
    keyType: z.string(),
    privateKey: z.string(),
    keyComment: z.string().optional(),
  }),
  z.object({
    type: z.enum(['passport', 'identity-document']),
    issuingCountry: OPTIONAL_FIELD,
    passportType: OPTIONAL_FIELD,
    passportNumber: OPTIONAL_FIELD,
    documentNumber: OPTIONAL_FIELD,
    nationalIdentificationNumber: OPTIONAL_FIELD,
    identificationNumber: OPTIONAL_FIELD,
    nationality: OPTIONAL_FIELD,
    fullName: OPTIONAL_FIELD,
    birthDate: OPTIONAL_FIELD,
    birthPlace: OPTIONAL_FIELD,
    sex: OPTIONAL_FIELD,
    issueDate: OPTIONAL_FIELD,
    expiryDate: OPTIONAL_FIELD,
    issuingAuthority: OPTIONAL_FIELD,
  }),
  z.object({
    type: z.literal('api-key'),
    key: OPTIONAL_FIELD,
    username: OPTIONAL_FIELD,
    keyType: OPTIONAL_FIELD,
    url: OPTIONAL_FIELD,
    validFrom: OPTIONAL_FIELD,
    expiryDate: OPTIONAL_FIELD,
  }),
  z.object({
    type: z.literal('custom-fields'),
    label: z.string().optional(),
    fields: z.array(EDITABLE_FIELD),
  }),
  z.object({ type: z.literal('item-reference'), reference: LINKED_ITEM }),
  z.object({
    type: z.literal('file'),
    id: z.string(),
    name: z.string(),
    decryptedSize: z.int().nonnegative(),
    integrityHash: z.string(),
  }),
  z.object({ type: z.literal('passkey'), rpId: z.string() }),
]);

/** A credential of a type this importer does not know is kept as its type name, to be reported. */
const ANY_CREDENTIAL = z.union([CREDENTIAL, z.looseObject({ type: z.string() })]);

export type TCxfCredential = z.infer<typeof CREDENTIAL>;

const ITEM = z.object({
  id: z.string(),
  creationAt: z.int().nonnegative().optional(),
  modifiedAt: z.int().nonnegative().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  favorite: z.boolean().optional(),
  scope: z.object({ urls: z.array(z.string()).optional() }).optional(),
  credentials: z.array(ANY_CREDENTIAL),
  tags: z.array(z.string()).optional(),
  extensions: z.array(z.unknown()).optional(),
});

export type TCxfItem = z.infer<typeof ITEM>;

interface ICxfCollection {
  readonly id: string;
  readonly title: string;
  readonly items: readonly z.infer<typeof LINKED_ITEM>[];
  readonly subCollections?: readonly ICxfCollection[];
}

const COLLECTION: z.ZodType<ICxfCollection> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    items: z.array(LINKED_ITEM),
    subCollections: z.array(COLLECTION).optional(),
  })
);

export const CXF_HEADER_SCHEMA = z.object({
  version: z.object({ major: z.literal(1), minor: z.int().nonnegative() }),
  exporterRpId: z.string(),
  exporterDisplayName: z.string(),
  timestamp: z.int().nonnegative(),
  accounts: z.array(
    z.object({
      id: z.string(),
      collections: z.array(COLLECTION).optional(),
      items: z.array(ITEM),
    })
  ),
});

export type TCxfHeader = z.infer<typeof CXF_HEADER_SCHEMA>;
export type TCxfCollection = ICxfCollection;

export function isKnownCredential(credential: {
  readonly type: string;
}): credential is TCxfCredential {
  return CREDENTIAL.safeParse(credential).success;
}
