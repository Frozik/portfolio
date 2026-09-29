import { mergeProps } from './cellAttributes';

type TEvent = { defaultPrevented: boolean; preventDefault(): void };

function event(): TEvent {
  const state = { defaultPrevented: false, preventDefault: () => undefined };
  state.preventDefault = () => {
    state.defaultPrevented = true;
  };
  return state;
}

describe('mergeProps', () => {
  it('lets every extension see an event, in contribution order', () => {
    const seen: string[] = [];
    const props = mergeProps(
      [
        { id: 'a', props: () => ({ onDoubleClick: () => void seen.push('a') }) },
        { id: 'b', props: () => ({ onDoubleClick: () => void seen.push('b') }) },
      ],
      undefined
    );
    props.onDoubleClick?.(event() as never);
    expect(seen).toEqual(['a', 'b']);
  });

  it('stops at the extension that claimed the gesture with preventDefault', () => {
    const seen: string[] = [];
    const props = mergeProps(
      [
        {
          id: 'editing',
          props: () => ({
            onDoubleClick: (mouse: { preventDefault(): void }) => {
              seen.push('editing');
              mouse.preventDefault();
            },
          }),
        },
        { id: 'detail', props: () => ({ onDoubleClick: () => void seen.push('detail') }) },
      ],
      undefined
    );
    props.onDoubleClick?.(event() as never);
    expect(seen).toEqual(['editing']);
  });

  it('keeps a mouse event that started on a control inside the cell away from the extensions', () => {
    const seen: string[] = [];
    const props = mergeProps(
      [{ id: 'selection', props: () => ({ onMouseDown: () => void seen.push('selection') }) }],
      undefined
    );
    const cell = document.createElement('div');
    const field = document.createElement('input');
    cell.append(field);
    props.onMouseDown?.({ ...event(), target: field } as never);
    expect(seen).toEqual([]);
    props.onMouseDown?.({ ...event(), target: cell } as never);
    expect(seen).toEqual(['selection']);
  });

  it('takes a plain attribute from the later contribution', () => {
    const props = mergeProps(
      [
        { id: 'a', props: () => ({ title: 'first' }) },
        { id: 'b', props: () => ({ title: 'second' }) },
      ],
      undefined
    );
    expect(props.title).toBe('second');
  });
});
