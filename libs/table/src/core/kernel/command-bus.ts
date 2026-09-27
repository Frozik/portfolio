export type TCommandOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** Returns the reason a command must not run, or `undefined` to allow it. */
export type TGuard<TPayload> = (payload: TPayload) => string | undefined;

export type TGuards<TCommands extends object> = {
  readonly [TName in keyof TCommands]?: TGuard<TCommands[TName]>;
};

export class CommandBus<TCommands extends object> {
  private readonly guards = new Map<keyof TCommands, Set<TGuard<never>>>();

  guard<TName extends keyof TCommands>(
    command: TName,
    guard: TGuard<TCommands[TName]>
  ): VoidFunction {
    const registered = this.guards.get(command) ?? new Set<TGuard<never>>();
    registered.add(guard as TGuard<never>);
    this.guards.set(command, registered);
    return () => {
      registered.delete(guard as TGuard<never>);
    };
  }

  guardAll(guards: TGuards<TCommands>): VoidFunction {
    const disposers = (Object.keys(guards) as (keyof TCommands)[]).flatMap(command => {
      const guard = guards[command];
      return guard === undefined ? [] : [this.guard(command, guard)];
    });
    return () => disposers.forEach(dispose => dispose());
  }

  /** The first reason any guard gives against the command, or `undefined` when it may run. */
  reasonAgainst<TName extends keyof TCommands>(
    command: TName,
    payload: TCommands[TName]
  ): string | undefined {
    const registered = this.guards.get(command);
    if (registered === undefined) {
      return undefined;
    }
    for (const guard of registered) {
      const reason = (guard as TGuard<TCommands[TName]>)(payload);
      if (reason !== undefined) {
        return reason;
      }
    }
    return undefined;
  }

  run<TName extends keyof TCommands>(
    command: TName,
    payload: TCommands[TName],
    execute: (payload: TCommands[TName]) => void
  ): TCommandOutcome {
    const reason = this.reasonAgainst(command, payload);
    if (reason !== undefined) {
      return { ok: false, reason };
    }
    execute(payload);
    return { ok: true };
  }

  clear(): void {
    this.guards.clear();
  }
}
