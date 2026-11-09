import { bookOf, custom } from '../testing/group-book-fixtures';
import type { TGroupColor } from './group';
import { freshColor } from './group-book';

const groupsWearing = (colors: readonly TGroupColor[]) =>
  colors.map((color, index) => custom(`group-${index}`, [], { color }));

describe('the colour of a new group', () => {
  it('is one no group wears yet — not the green «my contacts» already has', () => {
    expect(freshColor(bookOf(groupsWearing(['blue', 'teal'])))).toBe('amber');
  });

  it('is the least worn once every colour is taken', () => {
    const book = bookOf(
      groupsWearing(['blue', 'teal', 'amber', 'orange', 'red', 'pink', 'violet', 'blue', 'teal'])
    );
    expect(freshColor(book)).toBe('green');
  });
});
