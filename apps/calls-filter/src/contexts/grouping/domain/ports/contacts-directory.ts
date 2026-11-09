import type { ICaller } from '../../../phone/domain/caller';

/** A person the user picked in the system's contact picker, numbers as they are written there. */
export interface IPickedContact {
  readonly id: string;
  readonly displayName: string;
  readonly phones: readonly string[];
}

/** The address book: every number of every contact as the caller it would be, and the picker. */
export interface IContactsDirectory {
  callers(): Promise<readonly ICaller[]>;
  pick(): Promise<IPickedContact | null>;
}
