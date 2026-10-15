import { assert } from '@frozik/utils/assert/assert';
import { allFields } from '@frozik/vault/model/card';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { isNil } from 'lodash-es';
import { when } from 'mobx';

import { CLOUD_PUSH_DEBOUNCE_MS } from '../../cloud/application/CloudLink';
import { aCloud, aDevice, linkedToWebDav, openedFromTheCloud } from '../../testing/fake-device';
import { deleteUserTemplate, saveCardAsTemplate } from './template-actions';

describe('templates of the user’s own', () => {
  it('start new cards with a saved card’s fields, empty, and travel to the other device', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const session = first.store.session;
    assert(!isNil(session));
    const locker = aCardWith([
      aField({ kind: 'text' }, 'Locker 12', { label: 'Locker' }),
      aField({ kind: 'secret' }, '4711', { label: 'Combination' }),
    ]);
    session.apply(document => ({ ...document, cards: new Map([[locker.id, locker]]) }));

    const templateId = session.transact(
      saveCardAsTemplate(locker.id, 'Gym locker', session.random)
    );
    assert(!isNil(templateId));
    expect(session.view.userTemplates.map(template => template.name)).toEqual(['Gym locker']);
    session.editing.startCreating(templateId, key => `translated ${key}`);
    const draft = session.editing.draft;
    assert(!isNil(draft));
    expect(allFields(draft.card).map(field => [field.label, field.value])).toEqual([
      ['Locker', { cardinality: 'single', value: '' }],
      ['Combination', { cardinality: 'single', value: '' }],
    ]);
    session.editing.close();

    session.cloud.requestPush();
    first.device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => session.cloud.status.kind === 'synced');
    const second = await openedFromTheCloud(aDevice({ cloud, seed: 9 }));
    expect(second.session?.view.userTemplates.map(template => template.name)).toEqual([
      'Gym locker',
    ]);

    session.transact(deleteUserTemplate(templateId));
    expect(session.view.userTemplates).toEqual([]);
  });
});
