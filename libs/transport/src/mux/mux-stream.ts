import type { IBidirectionalStream } from '../shared/session';
import type { MuxMessage } from './mux-message';
import { MUX_TYPE } from './mux-message';

export interface MuxStreamLink {
  /** Sends a small control message right away. */
  sendControl(message: MuxMessage): void;
  /** Sends DATA once the socket's own send buffer has drained. */
  sendData(message: MuxMessage): Promise<void>;
  /** The peer broke the protocol: the whole session goes down. */
  violation(reason: string): void;
  /** Both directions are finished; the session forgets the stream. */
  released(streamId: number): void;
}

export interface MuxStreamLimits {
  readonly initialCredit: number;
  readonly maxDataBytes: number;
}

type RemoteState = 'open' | 'finished' | 'reset';

/**
 * One multiplexed stream with credit-based flow control: the peer may send
 * only as many bytes as this side has granted, and grants are returned only
 * after the consumer actually reads. A peer that ignores its credit is a
 * protocol violation, so buffered bytes per stream never exceed the credit.
 */
export class MuxStream implements IBidirectionalStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;

  private readonly inbox: Uint8Array[] = [];
  private remoteState: RemoteState = 'open';
  private failure: Error | undefined;
  private receivedBytes = 0;
  private grantedBytes: number;
  private consumedSinceGrant = 0;
  private sendCredit: number;
  private localDone = false;
  private remoteDone = false;
  private isReleased = false;
  private wakeReader = Promise.withResolvers<void>();
  private wakeWriter = Promise.withResolvers<void>();
  private readableController: ReadableStreamDefaultController<Uint8Array> | undefined;
  private writableController: WritableStreamDefaultController | undefined;

  constructor(
    readonly id: number,
    private readonly link: MuxStreamLink,
    private readonly limits: MuxStreamLimits
  ) {
    this.grantedBytes = limits.initialCredit;
    this.sendCredit = limits.initialCredit;
    this.readable = new ReadableStream<Uint8Array>(
      {
        start: controller => {
          this.readableController = controller;
        },
        pull: controller => this.pull(controller),
        cancel: () => this.reset(new Error('stream cancelled')),
      },
      { highWaterMark: 0 }
    );
    this.writable = new WritableStream<Uint8Array>({
      start: controller => {
        this.writableController = controller;
      },
      write: chunk => this.write(chunk),
      close: () => this.finishLocal(),
      abort: reason => this.reset(reason instanceof Error ? reason : new Error(String(reason))),
    });
  }

  receiveData(bytes: Uint8Array): void {
    if (this.remoteState !== 'open') {
      this.link.violation(`DATA after the end of stream ${this.id}`);
      return;
    }
    this.receivedBytes += bytes.byteLength;
    if (this.receivedBytes > this.grantedBytes) {
      this.link.violation(`stream ${this.id} exceeded its credit`);
      return;
    }
    this.inbox.push(bytes);
    this.wakeReader.resolve();
  }

  receiveFin(): void {
    if (this.remoteState !== 'open') {
      return;
    }
    this.remoteState = 'finished';
    this.wakeReader.resolve();
  }

  receiveCredit(bytes: number): void {
    this.sendCredit += bytes;
    this.wakeWriter.resolve();
  }

  receiveReset(): void {
    this.fail(new Error(`stream ${this.id} reset by peer`));
  }

  fail(error: Error): void {
    if (this.failure !== undefined) {
      return;
    }
    this.failure = error;
    this.remoteState = 'reset';
    this.readableController?.error(error);
    this.writableController?.error(error);
    this.wakeReader.resolve();
    this.wakeWriter.resolve();
    this.localDone = true;
    this.markRemoteDone();
  }

  private reset(reason: Error): void {
    if (this.failure !== undefined) {
      return;
    }
    this.link.sendControl({ type: MUX_TYPE.reset, streamId: this.id });
    this.fail(reason);
  }

  private async pull(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
    for (;;) {
      const chunk = this.inbox.shift();
      if (chunk !== undefined) {
        controller.enqueue(chunk);
        this.consumed(chunk.byteLength);
        return;
      }
      if (this.failure !== undefined) {
        return;
      }
      if (this.remoteState === 'finished') {
        controller.close();
        this.markRemoteDone();
        return;
      }
      this.wakeReader = Promise.withResolvers<void>();
      await this.wakeReader.promise;
    }
  }

  private consumed(bytes: number): void {
    this.consumedSinceGrant += bytes;
    if (this.consumedSinceGrant * 2 < this.limits.initialCredit) {
      return;
    }
    this.link.sendControl({
      type: MUX_TYPE.credit,
      streamId: this.id,
      bytes: this.consumedSinceGrant,
    });
    this.grantedBytes += this.consumedSinceGrant;
    this.consumedSinceGrant = 0;
  }

  private async write(chunk: Uint8Array): Promise<void> {
    let offset = 0;
    while (offset < chunk.byteLength) {
      while (this.sendCredit === 0 && this.failure === undefined) {
        this.wakeWriter = Promise.withResolvers<void>();
        await this.wakeWriter.promise;
      }
      if (this.failure !== undefined) {
        throw this.failure;
      }
      const size = Math.min(chunk.byteLength - offset, this.sendCredit, this.limits.maxDataBytes);
      this.sendCredit -= size;
      await this.link.sendData({
        type: MUX_TYPE.data,
        streamId: this.id,
        bytes: chunk.subarray(offset, offset + size),
      });
      offset += size;
    }
  }

  private finishLocal(): void {
    this.link.sendControl({ type: MUX_TYPE.fin, streamId: this.id });
    this.localDone = true;
    this.releaseWhenDone();
  }

  private markRemoteDone(): void {
    this.remoteDone = true;
    this.releaseWhenDone();
  }

  private releaseWhenDone(): void {
    if (this.localDone && this.remoteDone && !this.isReleased) {
      this.isReleased = true;
      this.link.released(this.id);
    }
  }
}
