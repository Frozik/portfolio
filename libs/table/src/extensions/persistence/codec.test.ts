import { decodeState, encodeState } from './codec';

const state = {
  columns: [{ id: 'name', width: 120 }],
  extensions: { sorting: [{ columnId: 'name', direction: 'asc' }] },
};

describe('state codec', () => {
  it('round-trips a state through a URL-safe token', () => {
    expect(decodeState(encodeState(state, 1), 1)).toEqual(state);
  });

  it('survives non-latin column ids', () => {
    const cyrillic = { columns: [{ id: 'цена' }], extensions: {} };
    expect(decodeState(encodeState(cyrillic, 1), 1)).toEqual(cyrillic);
  });

  it('rejects another version and garbage', () => {
    expect(decodeState(encodeState(state, 1), 2)).toBeUndefined();
    expect(decodeState('not base64', 1)).toBeUndefined();
  });
});
