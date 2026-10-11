import { aCard, aField, aTab } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { addTab, moveTab, removeTab, renameTab } from './tab-edits';

describe('tab edits', () => {
  it('adds titled tabs and reorders them', () => {
    const card = aCard();
    const { card: withScans, tabId } = addTab(card, 'Scans', createSeededRandom(4));

    const reordered = moveTab(withScans, tabId, 0);

    expect(reordered.tabs.map(tab => tab.title)).toEqual(['Scans', null]);
  });

  it('moves the fields of a removed tab into another one, or drops them', () => {
    const note = aField({ kind: 'note' }, 'n');
    const scan = aField({ kind: 'file' }, 'asset');
    const card = aCard({ tabs: [aTab([note], 'Main'), aTab([scan], 'Scans'), aTab([], 'Extra')] });
    const [main, scans] = card.tabs;

    expect(
      removeTab(card, scans?.id ?? main.id, { kind: 'move-to', tabId: main.id }).tabs.map(
        tab => tab.fields.length
      )
    ).toEqual([2, 0]);
    expect(
      removeTab(card, scans?.id ?? main.id, { kind: 'delete' }).tabs.map(tab => tab.fields.length)
    ).toEqual([1, 0]);
  });

  it('turns the card back into one untitled tab when the last but one goes', () => {
    const card = aCard({ tabs: [aTab([], 'Main'), aTab([], 'Scans')] });

    const single = removeTab(card, card.tabs[1]?.id ?? card.tabs[0].id, { kind: 'delete' });

    expect(single.tabs).toHaveLength(1);
    expect(single.tabs[0].title).toBeNull();
  });

  it('never removes or names the only tab', () => {
    const card = aCard();

    expect(removeTab(card, card.tabs[0].id, { kind: 'delete' })).toBe(card);
    expect(renameTab(card, card.tabs[0].id, 'Main')).toBe(card);
  });
});
