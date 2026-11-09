import type { IDialingRegion, TCountryCode } from '../../phone/domain/dialing-region';

/** What matching a caller depends on besides the groups: where the phone is from and where it is now. */
export interface IMatchingEnvironment {
  /** The SIM's country: national masks are written the way it dials. */
  readonly home: IDialingRegion;
  /** The network's country: «foreign» is relative to where the phone is now. */
  readonly networkCountry: TCountryCode | null;
}
