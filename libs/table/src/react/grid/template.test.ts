import type { IColumnLayout } from '../../core/columns/columns-model';
import { gridTemplate, isSpacer, rowTracks } from './template';

function layout(
  id: string,
  section: 'left' | 'center' | 'right',
  width: number
): IColumnLayout<unknown> {
  return {
    id,
    definition: { id, title: id, kind: 'text', value: () => undefined },
    section,
    index: 0,
    width,
    offset: 0,
    stickyOffset: undefined,
  };
}

describe('grid template', () => {
  it('places one spacer track before and one after the centre columns', () => {
    const window = {
      columns: [layout('pin', 'left', 40), layout('b', 'center', 100), layout('end', 'right', 50)],
      leftSpacer: 200,
      rightSpacer: 300,
    };
    expect(gridTemplate(window)).toBe('40px 200px 100px 300px 50px');
    expect(rowTracks(window).map(track => (isSpacer(track) ? '·' : track.id))).toEqual([
      'pin',
      '·',
      'b',
      '·',
      'end',
    ]);
  });

  it('still emits both spacers when a side has no columns', () => {
    const window = { columns: [layout('a', 'center', 100)], leftSpacer: 0, rightSpacer: 0 };
    expect(gridTemplate(window)).toBe('0px 100px 0px');
    expect(rowTracks(window).map(track => (isSpacer(track) ? '·' : track.id))).toEqual([
      '·',
      'a',
      '·',
    ]);
  });
});
