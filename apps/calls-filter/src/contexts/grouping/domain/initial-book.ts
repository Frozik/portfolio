import type { Temporal } from 'temporal-polyfill';

import { ALWAYS_PASS } from '../../policy/domain/policy';
import type { TGroupId } from './group';
import type { GroupBook } from './group-book';
import { groupBook } from './group-book';

/** The fixed ids of the two special groups: the same on every phone, so books merge. */
const MY_CONTACTS_GROUP_ID = 'my-contacts' as TGroupId;
const STRANGERS_GROUP_ID = 'strangers' as TGroupId;

/** A first launch: only «my contacts» and «strangers», both letting every call through. */
export function initialBook(now: Temporal.Instant): GroupBook {
  return groupBook([
    {
      kind: 'my-contacts',
      id: MY_CONTACTS_GROUP_ID,
      color: 'green',
      exclude: [],
      policy: ALWAYS_PASS,
      enabled: true,
      autoReply: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      kind: 'strangers',
      id: STRANGERS_GROUP_ID,
      color: 'slate',
      policy: ALWAYS_PASS,
      enabled: true,
      autoReply: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}
