/** A call as the service wrote it to its journal: the wire shape of the module. */
export interface INativeCallRecord {
  readonly epochMs: number;
  readonly rawNumber: string | null;
  readonly number: string | null;
  readonly networkName: string | null;
  readonly contactName: string | null;
  readonly contactLookupKey: string | null;
  readonly groupId: string;
  readonly verdict: 'PASSED' | 'REJECTED' | 'AWAITING_REPEAT' | 'PASSED_AS_REPEAT' | 'PAUSED';
  readonly actionSource: 'ALWAYS' | 'CONDITIONS_HOLD' | 'NONE_IN_FORCE';
  readonly alsoClaimedBy: readonly string[];
}

interface INativeDiagnosticsEntry {
  readonly epochMs: number;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly category: string;
  readonly event: string;
  readonly fields: Readonly<Record<string, string>>;
}

/** An incoming call from Android's own call log. */
interface INativeSystemCall {
  readonly epochMs: number;
  readonly rawNumber: string | null;
  readonly kind: 'incoming' | 'missed' | 'rejected' | 'blocked';
  readonly contactName: string | null;
  readonly contactId: string | null;
  /** The name the dialer wrote into the call log: the contact's, the network's, or its caller ID's. */
  readonly cachedName: string | null;
  /** The name the network sent with the call, on the phones whose call log keeps it apart. */
  readonly networkName: string | null;
}

/** A zone as Android names it in the app's language. */
interface INativeTimeZone {
  readonly id: string;
  readonly city: string;
  readonly name: string;
  readonly offsetMinutes: number;
}

export interface ICallScreeningModule {
  publishRuleset(base64: string): void;
  calls(sinceEpochMs: number, limit: number): Promise<readonly INativeCallRecord[]>;
  diagnostics(limit: number): readonly INativeDiagnosticsEntry[];
  log(
    level: string,
    category: string,
    event: string,
    fields: Readonly<Record<string, string>>
  ): void;
  setVerboseDiagnostics(untilEpochMs: number | null): void;
  pausedUntil(): number | null;
  setPausedUntil(untilEpochMs: number | null): void;
  setRetentionDays(days: number): void;
  /** How many days the service keeps its journal, as it was last told. */
  retentionDays(): number;
  setAtPlace(placeId: string, inside: boolean | null): void;
  atPlace(placeId: string): boolean | null;
  knownPlaces(): readonly string[];
  dismissWhereTo(): void;
  networkCountry(): string | null;
  simCountry(): string | null;
  appLanguage(): string | null;
  setAppLanguage(tag: string | null): void;
  systemLanguages(): readonly string[];
  systemCallLog(sinceEpochMs: number, limit: number): Promise<readonly INativeSystemCall[]>;
  openContact(contactId: string): void;
  openSettings(place: 'app-permissions' | 'notifications' | 'default-apps' | 'add-account'): void;
  timeZones(): readonly INativeTimeZone[];
  holdsScreeningRole(): boolean;
  requestScreeningRole(): Promise<boolean>;
  /** Opens the e2e build's command channel; `false` in any other build, where it does not exist. */
  openE2eControl(): boolean;
  answerE2eCommand(id: string, json: string): void;
  /** The e2e build only: the service screens a call as if the network had sent this name. */
  screenE2eCall(rawNumber: string, networkName: string | null): Promise<'allowed' | 'rejected'>;
  addListener(event: 'onCallScreened', listener: () => void): { remove(): void };
  addListener(
    event: 'onE2eCommand',
    listener: (command: { readonly id: string; readonly payload: string }) => void
  ): { remove(): void };
}
