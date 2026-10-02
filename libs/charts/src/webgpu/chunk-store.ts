import { isNil } from 'lodash-es';

import type { IStyledRun } from '../core/series/style-processor';
import type { DataTexture } from './data-texture';
import { elementsPerSlot, encodeElements } from './texel-encoding';

/** Where a chunk lies in the texture and how many elements it holds. */
export interface IChunkRef {
  readonly texel: number;
  readonly count: number;
}

interface IChunk {
  slot: number | undefined;
  /** Elements written to the slot; fewer than the chunk holds means it must be written again. */
  written: number;
}

interface IResidentRun {
  styled: IStyledRun<unknown>;
  readonly chunks: IChunk[];
}

/**
 * The styled runs of one chart in its data texture, a chunk per slot. A chunk
 * is written when it is first drawn and again only when its run or style
 * changed; a slot taken by eviction is refilled from the run in memory (§4.7).
 */
export class ChunkStore {
  private readonly runs = new Map<string, IResidentRun>();
  private readonly owners = new Map<number, IChunk>();

  constructor(private readonly texture: DataTexture) {}

  /** The texture reused this slot for another chunk. */
  evicted(slot: number): void {
    const chunk = this.owners.get(slot);
    if (!isNil(chunk)) {
      chunk.slot = undefined;
      chunk.written = 0;
      this.owners.delete(slot);
    }
  }

  /** The chunks holding elements `from`…`to` of a run, uploaded and ready to draw. */
  resident(key: string, styled: IStyledRun<unknown>, from: number, to: number): IChunkRef[] {
    const perSlot = elementsPerSlot(styled.run.shape);
    const resident = this.residentRun(key, styled, perSlot);
    const refs: IChunkRef[] = [];
    const lastChunk = Math.min(Math.ceil(to / perSlot), resident.chunks.length);
    for (let index = Math.floor(from / perSlot); index < lastChunk; index += 1) {
      const first = index * perSlot;
      const count = Math.min(perSlot, styled.run.length - first);
      const slot = this.upload(resident, index, first, count);
      if (isNil(slot)) {
        break;
      }
      refs.push({ texel: this.texture.texelOf(slot), count });
    }
    return refs;
  }

  /** Frees the slots of every run not named: what is no longer shown at all. */
  retain(liveKeys: ReadonlySet<string>): void {
    for (const [key, resident] of this.runs) {
      if (!liveKeys.has(key)) {
        this.release(resident);
        this.runs.delete(key);
      }
    }
  }

  dispose(): void {
    this.runs.clear();
    this.owners.clear();
  }

  private residentRun(key: string, styled: IStyledRun<unknown>, perSlot: number): IResidentRun {
    const chunkCount = Math.ceil(styled.run.length / perSlot);
    const existing = this.runs.get(key);
    if (isNil(existing)) {
      const created: IResidentRun = {
        styled,
        chunks: Array.from({ length: chunkCount }, () => ({ slot: undefined, written: 0 })),
      };
      this.runs.set(key, created);
      return created;
    }
    if (existing.styled !== styled) {
      const restyled = existing.styled.styleRevision !== styled.styleRevision;
      // A run only grows at its end: everything before its last chunk is as it was.
      const firstChanged = restyled ? 0 : Math.floor(existing.styled.run.length / perSlot);
      for (let index = firstChanged; index < existing.chunks.length; index += 1) {
        existing.chunks[index].written = 0;
      }
      while (existing.chunks.length < chunkCount) {
        existing.chunks.push({ slot: undefined, written: 0 });
      }
      existing.styled = styled;
    }
    return existing;
  }

  private upload(
    resident: IResidentRun,
    index: number,
    first: number,
    count: number
  ): number | undefined {
    const chunk = resident.chunks[index];
    if (isNil(chunk.slot)) {
      chunk.slot = this.texture.acquire();
      if (isNil(chunk.slot)) {
        return undefined;
      }
      this.owners.set(chunk.slot, chunk);
    }
    if (chunk.written !== count) {
      const { run, style } = resident.styled;
      this.texture.write(chunk.slot, encodeElements(run, style, first, count));
      chunk.written = count;
    }
    this.texture.touch(chunk.slot);
    return chunk.slot;
  }

  private release(resident: IResidentRun): void {
    for (const chunk of resident.chunks) {
      if (!isNil(chunk.slot)) {
        this.owners.delete(chunk.slot);
        this.texture.release(chunk.slot);
      }
    }
  }
}
