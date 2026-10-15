import { hlcTick, initialHlc } from '@frozik/vault/model/hlc';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import { renameVault } from '@frozik/vault/model/vault-settings-edits';

import { SessionDocument } from './SessionDocument';

const START = hlcTick(initialHlc('device-a'), 1000);

function aDocument(access: 'read-write' | 'read-only' = 'read-write') {
  let edits = 0;
  const content = new SessionDocument(
    { document: emptyVaultDocument('Family', START), access, clock: START },
    { now: () => 1000, onEdited: () => (edits += 1) }
  );
  return { content, edits: () => edits };
}

const rename =
  (name: string) => (document: ReturnType<typeof emptyVaultDocument>, at: typeof START) => ({
    document: renameVault(document, { name, description: '' }, at),
    result: name,
  });

describe('the open vault’s document', () => {
  it('takes an edit stamped past the last one and says it changed', () => {
    const { content, edits } = aDocument();

    expect(content.transact(rename('Family & friends'))).toBe('Family & friends');
    expect(content.document.settings.name).toBe('Family & friends');
    expect(content.stamp.counter).toBeGreaterThan(START.counter);
    expect(edits()).toBe(1);
  });

  it('refuses every edit once read-only', () => {
    const { content, edits } = aDocument();
    content.makeReadOnly();

    expect(content.transact(rename('Elsewhere'))).toBeNull();
    expect(content.document.settings.name).toBe('Family');
    expect(edits()).toBe(0);
  });

  it('merges another copy, reporting a change and whether it holds news the other lacks', () => {
    const { content } = aDocument();
    const other = aDocument();
    other.content.transact(rename('Renamed elsewhere'));

    const outcome = content.merge(other.content.document);

    expect(outcome.changed).toBe(true);
    expect(content.document.settings.name).toBe('Renamed elsewhere');
    expect(content.merge(other.content.document)).toEqual({ changed: false, localHasNews: false });
  });
});
