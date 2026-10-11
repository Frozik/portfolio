import { aCard, aCardWith, aField, aTab } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { allFields } from './card';
import {
  addField,
  moveField,
  normalizeCardValues,
  removeField,
  setFieldSpec,
  setFieldValue,
  setTypedFieldValue,
} from './field-edits';
import { cardState } from './revision-edits';

describe('field edits', () => {
  it('stores a value in the canonical form of its kind, list entries one by one', () => {
    const urls = aField({ kind: 'url', match: 'host', useSharedCredentials: true }, [
      'example.com',
    ]);
    const card = aCard({ tabs: [aTab([urls])] });

    const next = setFieldValue(card, urls.id, {
      cardinality: 'list',
      values: ['shop.example', 'https://a.example'],
    });

    expect(allFields(next)[0]?.value).toEqual({
      cardinality: 'list',
      values: ['https://shop.example', 'https://a.example'],
    });
  });

  it('keeps the cardinality a field was made with', () => {
    const urls = aField({ kind: 'url', match: 'host', useSharedCredentials: true }, [
      'https://a.example',
      'https://b.example',
    ]);
    const card = aCard({ tabs: [aTab([urls])] });

    expect(
      setFieldValue(card, urls.id, { cardinality: 'single', value: 'https://only.example' })
    ).toEqual(card);
  });

  it('never writes into a field of a kind from a newer version', () => {
    const future = aField({ kind: 'unknown', raw: { kind: 'passkey' } }, 'opaque');
    const card = aCard({ tabs: [aTab([future])] });

    expect(setFieldValue(card, future.id, { cardinality: 'single', value: 'changed' })).toEqual(
      card
    );
  });

  it('adds a field with its kind defaults, as a list only where the kind allows one', () => {
    const card = aCard();
    const random = createSeededRandom(2);

    const withCode = addField(
      card,
      card.tabs[0].id,
      { kind: 'otp', label: 'Code', cardinality: 'list' },
      random
    ).card;
    const withSites = addField(
      withCode,
      card.tabs[0].id,
      { kind: 'url', label: 'Sites', cardinality: 'list' },
      random
    ).card;

    expect(
      allFields(withSites).map(field => [field.spec.kind, field.sensitive, field.value.cardinality])
    ).toEqual([
      ['otp', true, 'single'],
      ['url', false, 'list'],
    ]);
  });

  it('moves a field into another tab at a position, and removes it', () => {
    const login = aField({ kind: 'login' }, 'alice');
    const password = aField({ kind: 'password', rotateEveryDays: null }, 'secret');
    const key = aField({ kind: 'multiline' }, 'ssh-ed25519');
    const card = aCard({ tabs: [aTab([login, password]), aTab([key], 'Keys')] });

    const moved = moveField(card, password.id, card.tabs[1]?.id ?? card.tabs[0].id, 0);

    expect(moved.tabs.map(tab => tab.fields.map(field => field.id))).toEqual([
      [login.id],
      [password.id, key.id],
    ]);
    expect(allFields(removeField(moved, password.id)).map(field => field.id)).toEqual([
      login.id,
      key.id,
    ]);
  });

  it('changes the parameters of a field but never its kind', () => {
    const site = aField(
      { kind: 'url', match: 'host', useSharedCredentials: true },
      'https://a.example'
    );
    const card = aCard({ tabs: [aTab([site])] });

    expect(
      allFields(
        setFieldSpec(card, site.id, {
          kind: 'url',
          match: 'base-domain',
          useSharedCredentials: true,
        })
      )[0]?.spec
    ).toMatchObject({
      match: 'base-domain',
    });
    expect(setFieldSpec(card, site.id, { kind: 'text' })).toEqual(card);
  });
});

describe('typing and saving a value', () => {
  it('keeps what is typed until "Save" puts it in its canonical form', () => {
    const otp = aField({ kind: 'otp' }, '', { label: 'Code' });
    const card = cardState(aCardWith([otp], { title: 'GitHub' }));

    const typed = setTypedFieldValue(card, otp.id, {
      cardinality: 'single',
      value: 'JBSWY3DPEHPK3PXP',
    });
    const [typedField] = allFields(typed);
    const [savedField] = allFields(normalizeCardValues(typed));

    expect(typedField?.value).toEqual({ cardinality: 'single', value: 'JBSWY3DPEHPK3PXP' });
    expect(savedField?.value).toMatchObject({
      value: expect.stringMatching(/^otpauth:\/\/totp\//),
    });
  });
});
