import { z } from 'zod';

import { BUILTIN_ICONS } from '../model/builtin-icons';
import type { TBankCodeScheme, TFieldKind, TSimpleFieldKind, TUrlMatch } from '../model/card';
import { CARD_COLORS } from '../model/card-appearance';
import { FIELD_KINDS } from '../model/field-kinds/registry';
import type { TGroupId, TTemplateId } from '../model/ids';
import { ICON_DOMAIN } from '../model/site-icons';
import type { TSmartGroupRule } from '../model/smart-group-rule';

/** The JSON files of the container, checked once at the boundary. */
export const HLC_SCHEMA = z.object({
  wallMs: z.int().nonnegative(),
  counter: z.int().nonnegative(),
  node: z.string(),
});

const SIMPLE_KINDS = [
  'text',
  'login',
  'email',
  'phone',
  'secret',
  'pin',
  'otp',
  'card-number',
  'cvv',
  'expiry-month',
  'expiry-date',
  'date',
  'boolean',
  'iban',
  'bic',
  'bank-account',
  'file',
  'multiline',
  'note',
] as const satisfies readonly TSimpleFieldKind[];

const URL_MATCHES = [
  'host',
  'base-domain',
  'exact',
  'starts-with',
  'regex',
  'never',
] as const satisfies readonly TUrlMatch[];
const BANK_CODE_SCHEMES = [
  'national',
  'aba-routing',
  'ca-routing',
  'sort-code',
  'bsb',
  'ifsc',
  'ru-bic',
] as const satisfies readonly TBankCodeScheme[];

export const KNOWN_FIELD_SPEC_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(SIMPLE_KINDS) }),
  z.object({
    kind: z.literal('password'),
    rotateEveryDays: z.int().positive().nullable().default(null),
  }),
  z.object({ kind: z.literal('select'), options: z.array(z.string()), allowCustom: z.boolean() }),
  z.object({ kind: z.literal('security-question'), question: z.string() }),
  z.object({ kind: z.literal('bank-code'), scheme: z.enum(BANK_CODE_SCHEMES) }),
  z.object({
    kind: z.literal('url'),
    match: z.enum(URL_MATCHES),
    useSharedCredentials: z.boolean(),
  }),
]);

export const FIELD_VALUE_SCHEMA = z.discriminatedUnion('cardinality', [
  z.object({ cardinality: z.literal('single'), value: z.string() }),
  z.object({ cardinality: z.literal('list'), values: z.array(z.string()) }),
]);

export const FIELD_SCHEMA = z.object({
  id: z.string(),
  label: z.string(),
  /** Kept whole: a kind or parameters from a newer version are shown as they came. */
  spec: z.looseObject({ kind: z.string() }),
  value: FIELD_VALUE_SCHEMA,
  sensitive: z.boolean(),
  excludeFromAudit: z.boolean(),
});

export const TAB_SCHEMA = z.object({
  id: z.string(),
  title: z.string().nullable(),
  fields: z.array(FIELD_SCHEMA),
});

/** An unknown colour or icon of a newer palette falls back to the default instead of failing the card. */
export const CARD_STATE_SCHEMA = z.object({
  id: z.string(),
  title: z.string(),
  templateId: z.string(),
  tabs: z.array(TAB_SCHEMA).min(1),
  groupIds: z.array(z.string()),
  favorite: z.boolean(),
  color: z.enum(CARD_COLORS).nullable().catch(null),
  icon: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('auto') }),
      z.object({ kind: z.literal('builtin'), name: z.enum(BUILTIN_ICONS) }),
      z.object({ kind: z.literal('custom'), assetId: z.string() }),
    ])
    .catch({ kind: 'auto' }),
  protected: z.boolean(),
  archivedAt: HLC_SCHEMA.nullable(),
  trashedAt: HLC_SCHEMA.nullable(),
  createdAt: HLC_SCHEMA,
  updatedAt: HLC_SCHEMA,
  ancestors: z.array(HLC_SCHEMA),
});

export const CARD_SCHEMA = CARD_STATE_SCHEMA.extend({
  history: z.array(z.object({ at: HLC_SCHEMA, snapshot: CARD_STATE_SCHEMA })),
});

export const VAULT_JSON_SCHEMA = z.object({
  name: z.string(),
  description: z.string().catch(''),
  settings: z.object({ expiryWarningDays: z.record(z.string(), z.int().nonnegative()) }),
  providerHint: z
    .object({ kind: z.string(), url: z.string().nullable(), username: z.string().nullable() })
    .nullable(),
  settingsUpdatedAt: HLC_SCHEMA,
  groups: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.enum(BUILTIN_ICONS).nullable().catch(null),
      color: z.enum(CARD_COLORS).nullable().catch(null),
      order: z.number(),
      updatedAt: HLC_SCHEMA,
    })
  ),
  /** Read one by one: a template a newer version shaped differently is left out, not fatal. */
  templates: z.array(z.unknown()).default([]),
  /** The same: a rule this version does not know leaves its group out. */
  smartGroups: z.array(z.unknown()).default([]),
});

const FIELD_KIND_SCHEMA = z.custom<TFieldKind>(
  value => typeof value === 'string' && Object.hasOwn(FIELD_KINDS, value)
);

export const SMART_GROUP_RULE_SCHEMA: z.ZodType<TSmartGroupRule> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('expiry'), status: z.enum(['soon', 'expired']) }),
    z.object({
      kind: z.literal('template'),
      templateIds: z.array(z.string().transform(id => id as TTemplateId)),
    }),
    z.object({
      kind: z.literal('has-field'),
      fieldKind: FIELD_KIND_SCHEMA,
      value: z.string().optional(),
    }),
    z.object({ kind: z.literal('in-group'), groupId: z.string().transform(id => id as TGroupId) }),
    z.object({
      kind: z.enum([
        'favorite',
        'trashed',
        'archived',
        'protected',
        'no-group',
        'audit-problem',
        'possible-duplicate',
      ]),
    }),
    z.object({ kind: z.enum(['all', 'any']), rules: z.array(SMART_GROUP_RULE_SCHEMA) }),
    z.object({ kind: z.literal('not'), rule: SMART_GROUP_RULE_SCHEMA }),
  ])
);

export const USER_SMART_GROUP_SCHEMA = z.object({
  id: z.string().startsWith('smart-'),
  name: z.string(),
  rule: SMART_GROUP_RULE_SCHEMA,
  updatedAt: HLC_SCHEMA,
});

export const USER_TEMPLATE_SCHEMA = z.object({
  id: z.string().startsWith('user-'),
  name: z.string(),
  icon: z.enum(BUILTIN_ICONS).catch('file'),
  tabs: z
    .array(
      z.object({
        title: z.string().nullable(),
        fields: z.array(
          z.object({
            label: z.string(),
            cardinality: z.enum(['single', 'list']),
            spec: KNOWN_FIELD_SPEC_SCHEMA,
            sensitive: z.boolean(),
          })
        ),
      })
    )
    .min(1),
  updatedAt: HLC_SCHEMA,
});

export const LINKS_SCHEMA = z.array(
  z.object({ id: z.string(), a: z.string(), b: z.string(), createdAt: HLC_SCHEMA })
);

export const TOMBSTONES_SCHEMA = z.record(
  z.string().regex(/^(card|link|group|template):.+$/),
  HLC_SCHEMA
);

export const ASSETS_SCHEMA = z.record(
  z.string(),
  z.object({
    id: z.string(),
    name: z.string(),
    mime: z.string(),
    sha256: z.string(),
    storage: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('inline') }),
      z.object({ kind: z.literal('blob'), key: z.string() }),
    ]),
    orphanedAt: HLC_SCHEMA.nullable(),
    createdAt: HLC_SCHEMA,
  })
);

export const HOTP_COUNTERS_SCHEMA = z.record(
  z.string().regex(/^[^/]+\/[^/]+$/),
  z.int().nonnegative()
);

/** Which domains have an icon file beside it, and which were found without one. */
export const SITE_ICONS_SCHEMA = z.array(
  z.object({
    domain: z.string().regex(ICON_DOMAIN),
    kind: z.enum(['icon', 'none']),
    at: HLC_SCHEMA,
  })
);
