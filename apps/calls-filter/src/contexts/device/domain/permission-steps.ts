import type { TPermission, TPermissionState } from './ports/permissions';

/** One thing the app asks the phone for: the screening role, or a runtime permission. */
export type TPermissionStep = 'screening-role' | TPermission;

export interface IPermissionFacts {
  readonly holdsRole: boolean;
  readonly permissions: Readonly<Record<TPermission, TPermissionState>>;
  /** A group looks at a calendar of the phone. */
  readonly usesDeviceCalendars: boolean;
  /** A group answers with an SMS. */
  readonly usesAutoReply: boolean;
  /** A group looks at where the phone is. */
  readonly usesPlaces: boolean;
}

/** The order the app asks in: without the role nothing is screened, so it comes first. */
const ALWAYS_NEEDED: readonly TPermission[] = [
  'contacts',
  'call-log',
  'phone-state',
  'notifications',
];

/** What the app still lacks for what the user set up, in the order it asks for them. */
export function missingSteps(facts: IPermissionFacts): readonly TPermissionStep[] {
  const needed: readonly TPermission[] = [
    ...ALWAYS_NEEDED,
    ...(facts.usesDeviceCalendars ? (['calendar'] as const) : []),
    ...(facts.usesAutoReply ? (['sms'] as const) : []),
    ...(facts.usesPlaces ? (['location', 'background-location'] as const) : []),
  ];
  return [
    ...(facts.holdsRole ? [] : (['screening-role'] as const)),
    ...needed.filter(permission => facts.permissions[permission] !== 'granted'),
  ];
}
