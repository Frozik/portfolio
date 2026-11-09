/** The phone's contacts: open one in the contacts app, and where its photo is. */
export interface IContactViewer {
  open(contactId: string): void;
  /** An address an image can load; the photo may not exist, the view falls back by itself. */
  photoUri(contactId: string): string;
}
