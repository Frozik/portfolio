import { assert } from '@frozik/utils/assert/assert';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { isNil } from 'lodash-es';
import { when } from 'mobx';

import { aDevice } from './fake-device.test-helper';
import { SmartGroupBuilder } from './SmartGroupBuilder';

async function aSessionWithCards() {
  const store = aDevice().startStore();
  store.create('Home', 'correct horse battery staple');
  await when(() => store.session !== null);
  const { session } = store;
  assert(!isNil(session));
  const otp = aField({ kind: 'otp' }, 'otpauth://totp/x?secret=JBSWY3DP');
  const cards = [
    aCardWith([otp], { title: 'GitHub' }),
    aCardWith([otp], { title: 'Bank', favorite: true }),
    aCardWith([], { title: 'Wi-Fi' }),
  ];
  session.apply(document => ({ ...document, cards: new Map(cards.map(card => [card.id, card])) }));
  return session;
}

describe('the smart group builder', () => {
  it('saves a named rule whose members the sidebar counts, edits it, and deletes it', async () => {
    const session = await aSessionWithCards();
    const builder = new SmartGroupBuilder(
      { document: () => session.document, transact: session.transact, random: session.random },
      null
    );
    builder.setName('Codes to review');
    builder.setKind(0, 'has-field');
    builder.addCondition();
    builder.setNegated(1, true);

    const groupId = builder.save();
    assert(!isNil(groupId));
    expect(session.view.userSmartGroups.map(group => group.name)).toEqual(['Codes to review']);
    expect(session.view.countOf(groupId)).toBe(1);

    const group = session.document.smartGroups.get(groupId);
    assert(!isNil(group));
    const editing = new SmartGroupBuilder(
      { document: () => session.document, transact: session.transact, random: session.random },
      group
    );
    expect(editing.conditions.map(({ negated, rule }) => [negated, rule.kind])).toEqual([
      [false, 'has-field'],
      [true, 'favorite'],
    ]);
    editing.setMode('any');
    editing.save();
    expect(session.view.countOf(groupId)).toBe(3);

    expect(editing.delete()).toBe(groupId);
    expect(session.view.userSmartGroups).toEqual([]);
  });
});
