import type { ServiceImpl } from '@connectrpc/connect';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import { Crc32 } from '@frozik/utils/hash/crc32';

import { CallFailedError } from '../domain/call-failure';
import { verifyEcho } from '../domain/echo';
import type { EchoRequest } from '../domain/ports/file-echo';
import { createFileEcho } from './file-echo';

const MAX_CHUNK_BYTES = 4;

/** Sends every chunk straight back and closes with the summary of what it saw. */
function echoService(
  alter: (bytes: Uint8Array) => Uint8Array = bytes => bytes
): Partial<ServiceImpl<typeof FileService>> {
  return {
    async *echo(requests) {
      const crc = new Crc32();
      let bytes = 0;
      for await (const request of requests) {
        if (request.part.case === 'chunk') {
          crc.update(request.part.value);
          bytes += request.part.value.byteLength;
          yield { part: { case: 'chunk', value: alter(request.part.value) } };
        }
      }
      yield {
        part: {
          case: 'summary',
          value: { bytes: BigInt(bytes), crc32: crc.value, maxBufferedBytes: 4n },
        },
      };
    },
  };
}

function fileEchoOver(service: Partial<ServiceImpl<typeof FileService>>) {
  return createFileEcho(createRouterTransport(router => router.service(FileService, service)));
}

function request(bytes: readonly number[], written: Uint8Array[] = []): EchoRequest {
  return {
    source: new File([Uint8Array.from(bytes)], 'a.bin'),
    destination: new WritableStream({ write: chunk => void written.push(chunk) }),
    maxChunkBytes: MAX_CHUNK_BYTES,
    signal: new AbortController().signal,
    onProgress: () => undefined,
  };
}

describe('file echo over Connect', () => {
  it('writes the echo into the destination in chunks the server accepts', async () => {
    const written: Uint8Array[] = [];

    const { summary, tally } = await fileEchoOver(echoService()).echo(
      request([1, 2, 3, 4, 5, 6, 7, 8, 9], written)
    );

    expect(written.flatMap(chunk => [...chunk])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(written.every(chunk => chunk.byteLength <= MAX_CHUNK_BYTES)).toBe(true);
    expect(verifyEcho(tally, summary)).toBe('intact');
  });

  it('counts what came back, so bytes changed on the way show', async () => {
    const { summary, tally } = await fileEchoOver(
      echoService(bytes => bytes.map(byte => byte ^ 1))
    ).echo(request([1, 2, 3]));

    expect(verifyEcho(tally, summary)).toBe('checksum-mismatch');
  });

  it('reports a refused quota in the page terms and aborts the destination', async () => {
    const abort = vi.fn();
    const fileEcho = fileEchoOver({
      // oxlint-disable-next-line require-yield -- refuses before answering anything
      async *echo() {
        throw new ConnectError('4 GB an hour', Code.ResourceExhausted);
      },
    });

    const failure = await fileEcho
      .echo({ ...request([1]), destination: new WritableStream({ abort }) })
      .then(
        () => undefined,
        (error: unknown) => (error instanceof CallFailedError ? error.failure : undefined)
      );

    expect(failure).toEqual({ kind: 'quota', message: '4 GB an hour' });
    expect(abort).toHaveBeenCalled();
  });

  it('fails an echo that ends without the server summary', async () => {
    const fileEcho = fileEchoOver({
      async *echo(requests) {
        for await (const _ of requests) {
          yield { part: { case: 'chunk', value: new Uint8Array(1) } };
        }
      },
    });

    await expect(fileEcho.echo(request([1]))).rejects.toBeInstanceOf(CallFailedError);
  });
});
