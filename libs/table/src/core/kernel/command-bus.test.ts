import { CommandBus } from './command-bus';

type TCommands = { readonly 'columns.pin': { readonly columnId: string } };

describe('CommandBus', () => {
  it('executes a command nobody guards against', () => {
    const bus = new CommandBus<TCommands>();
    const executed: string[] = [];

    const outcome = bus.run('columns.pin', { columnId: 'price' }, ({ columnId }) =>
      executed.push(columnId)
    );

    expect(outcome).toEqual({ ok: true });
    expect(executed).toEqual(['price']);
  });

  it('refuses a command with the first guard reason and does not execute it', () => {
    const bus = new CommandBus<TCommands>();
    bus.guard('columns.pin', () => undefined);
    bus.guard('columns.pin', ({ columnId }) =>
      columnId === 'price' ? 'price stays put' : undefined
    );
    bus.guard('columns.pin', () => 'never reached');
    const executed: string[] = [];

    const outcome = bus.run('columns.pin', { columnId: 'price' }, ({ columnId }) =>
      executed.push(columnId)
    );

    expect(outcome).toEqual({ ok: false, reason: 'price stays put' });
    expect(executed).toEqual([]);
  });

  it('lets a command through again once its guard is removed', () => {
    const bus = new CommandBus<TCommands>();
    const unguard = bus.guard('columns.pin', () => 'locked');

    unguard();

    expect(bus.reasonAgainst('columns.pin', { columnId: 'price' })).toBeUndefined();
  });
});
