import { isNil } from 'lodash-es';

export function parseJson<T>(json: string | null): T | undefined {
  if (isNil(json)) {
    return undefined;
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}
