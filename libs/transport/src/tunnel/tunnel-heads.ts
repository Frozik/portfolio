import { z } from 'zod';

const HeaderEntriesSchema = z.array(z.tuple([z.string(), z.string()])).readonly();

export const RequestHeadSchema = z
  .object({ method: z.string(), url: z.string(), header: HeaderEntriesSchema })
  .readonly();

export const ResponseHeadSchema = z
  .object({ status: z.number().int(), header: HeaderEntriesSchema })
  .readonly();

export const EndSchema = z.object({ trailer: HeaderEntriesSchema }).readonly();

export type RequestHead = z.infer<typeof RequestHeadSchema>;
export type ResponseHead = z.infer<typeof ResponseHeadSchema>;
export type End = z.infer<typeof EndSchema>;

export function headerEntries(headers: Headers | undefined): [string, string][] {
  return headers === undefined ? [] : Array.from(headers.entries());
}

export function toHeaders(entries: readonly (readonly [string, string])[]): Headers {
  const headers = new Headers();
  for (const [name, value] of entries) {
    headers.append(name, value);
  }
  return headers;
}
