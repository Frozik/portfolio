import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

const TEXT = 'text';
const REPEATED: ReadonlySet<string> = new Set([
  'label',
  'card',
  'field',
  'label_id',
  'file',
  'image',
]);

/** Values keep their spaces and stay strings: a password of digits is not a number. */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: TEXT,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  isArray: tagName => REPEATED.has(tagName),
});

/** An element with attributes is an object with its text under `text`; without, the text itself. */
const elementText = z.union([z.string(), z.looseObject({ text: z.string().optional() })]);

const FIELD_SCHEMA = z.looseObject({
  name: z.string().optional(),
  type: z.string().optional(),
  text: z.string().optional(),
});

const CARD_SCHEMA = z.looseObject({
  title: z.string().optional(),
  color: z.string().optional(),
  star: z.string().optional(),
  template: z.string().optional(),
  deleted: z.string().optional(),
  field: z.array(FIELD_SCHEMA).optional(),
  notes: elementText.optional(),
  label_id: z.array(elementText).optional(),
  file: z.array(z.looseObject({ name: z.string().optional() })).optional(),
  image: z.array(z.unknown()).optional(),
});

const DATABASE_SCHEMA = z.looseObject({
  database: z.looseObject({
    label: z.array(z.looseObject({ id: z.string(), name: z.string() })).optional(),
    card: z.array(CARD_SCHEMA).optional(),
  }),
});

export type TSafeInCloudCard = z.infer<typeof CARD_SCHEMA>;
export type TSafeInCloudDatabase = z.infer<typeof DATABASE_SCHEMA>['database'];

export function textOf(element: z.infer<typeof elementText> | undefined): string {
  return typeof element === 'string' ? element : (element?.text ?? '');
}

/** SafeInCloud's XML export: `<database>` of labels and cards; `null` for any other text. */
export function parseSafeInCloud(text: string): TSafeInCloudDatabase | null {
  let parsed: unknown;
  try {
    parsed = parser.parse(text);
  } catch {
    return null;
  }
  const database = DATABASE_SCHEMA.safeParse(parsed);
  return database.success ? database.data.database : null;
}
