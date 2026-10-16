import type { IValueCodec } from '@frozik/utils/storage/valueStorage';
import { createValueStorage } from '@frozik/utils/storage/valueStorage';

import type { Following, FollowingStorage } from '../application/ports/following-storage';

const FOLLOWING_STORAGE_KEY = 'space-golf:following';
const FOLLOWINGS: readonly Following[] = ['edge', 'rest', 'always'];

const FOLLOWING_CODEC: IValueCodec<Following> = {
  fallback: 'rest',
  parse: raw => FOLLOWINGS.find(following => following === raw),
  serialize: String,
};

export function createFollowingStorage(storage: Storage = localStorage): FollowingStorage {
  return createValueStorage(FOLLOWING_STORAGE_KEY, FOLLOWING_CODEC, storage);
}
