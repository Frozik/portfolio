type THandler<TPayload> = (payload: TPayload) => void;

export class EventBus<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<THandler<never>>>();

  on<TName extends keyof TEvents>(event: TName, handler: THandler<TEvents[TName]>): VoidFunction {
    const listeners = this.handlers.get(event) ?? new Set<THandler<never>>();
    listeners.add(handler as THandler<never>);
    this.handlers.set(event, listeners);
    return () => {
      listeners.delete(handler as THandler<never>);
    };
  }

  emit<TName extends keyof TEvents>(event: TName, payload: TEvents[TName]): void {
    const listeners = this.handlers.get(event);
    if (listeners === undefined) {
      return;
    }
    for (const handler of listeners) {
      (handler as THandler<TEvents[TName]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
