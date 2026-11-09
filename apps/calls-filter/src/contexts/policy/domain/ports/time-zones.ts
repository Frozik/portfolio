/** A zone the user can put a schedule on, named in the app's language. */
export interface ITimeZone {
  readonly id: string;
  readonly city: string;
  readonly name: string;
  /** From UTC right now; for sorting and showing «GMT+02:00». */
  readonly offsetMinutes: number;
}

export type TListTimeZones = () => readonly ITimeZone[];
