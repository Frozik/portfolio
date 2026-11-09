/** The system's share sheet: a file goes to a messenger, the mail or Files. */
export type TShareFile = (file: {
  readonly name: string;
  readonly mime: string;
  readonly text: string;
}) => Promise<'shared' | 'unavailable' | 'failed'>;
