import type { IRoomAwareness } from '../domain/ports/room-awareness';

/** In-memory awareness: one local client plus whatever remote states a test injects. */
export class FakeRoomAwareness implements IRoomAwareness {
  readonly meta = new Map<number, { lastUpdated: number }>();
  private readonly states = new Map<number, Record<string, unknown>>();
  private readonly listeners = new Set<() => void>();
  private clock = 0;

  constructor(private readonly localClientId: number) {}

  on(_event: 'change', listener: () => void): void {
    this.listeners.add(listener);
  }

  off(_event: 'change', listener: () => void): void {
    this.listeners.delete(listener);
  }

  setLocalState(state: null): void {
    if (state === null) {
      this.states.delete(this.localClientId);
      this.emit();
    }
  }

  setLocalStateField(field: string, value: unknown): void {
    this.setRemoteState(this.localClientId, {
      ...this.states.get(this.localClientId),
      [field]: value,
    });
  }

  setRemoteState(yjsClientId: number, state: Record<string, unknown>): void {
    this.states.set(yjsClientId, state);
    this.clock += 1;
    this.meta.set(yjsClientId, { lastUpdated: this.clock });
    this.emit();
  }

  getStates(): ReadonlyMap<number, Readonly<Record<string, unknown>>> {
    return this.states;
  }

  get localState(): Readonly<Record<string, unknown>> | undefined {
    return this.states.get(this.localClientId);
  }

  private emit(): void {
    this.listeners.forEach(listener => listener());
  }
}
