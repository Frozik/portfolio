import { EventBus } from './event-bus';

type TEvents = { readonly greeted: { readonly name: string }; readonly reset: undefined };

describe('EventBus', () => {
  it('delivers a payload to every handler of the event', () => {
    const bus = new EventBus<TEvents>();
    const seen: string[] = [];
    bus.on('greeted', ({ name }) => seen.push(`a:${name}`));
    bus.on('greeted', ({ name }) => seen.push(`b:${name}`));

    bus.emit('greeted', { name: 'Ann' });

    expect(seen).toEqual(['a:Ann', 'b:Ann']);
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new EventBus<TEvents>();
    const seen: string[] = [];
    const unsubscribe = bus.on('greeted', ({ name }) => seen.push(name));

    unsubscribe();
    bus.emit('greeted', { name: 'Ann' });

    expect(seen).toEqual([]);
  });

  it('ignores events nobody listens to', () => {
    const bus = new EventBus<TEvents>();
    expect(() => bus.emit('reset', undefined)).not.toThrow();
  });
});
