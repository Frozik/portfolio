import { render } from '@testing-library/react';

import type { TFieldKind } from '../../model/card';
import { FIELD_KINDS } from '../../model/field-kinds/registry';
import { aField } from '../../testing/builders';
import { SENSITIVE_CLASS } from '../sensitive-class';
import { FieldValueEditor } from './FieldValueEditor';

const SECRET_KINDS = (Object.keys(FIELD_KINDS) as TFieldKind[]).filter(
  kind => FIELD_KINDS[kind].sensitiveByDefault
);

/** Walked over the registry, so a new secret kind cannot slip past. */
describe('every secret field in the editor', () => {
  it.each(SECRET_KINDS)('%s: kept from other managers, Grammarly and bug-report captures', kind => {
    const { container } = render(
      <FieldValueEditor
        field={aField(FIELD_KINDS[kind].defaultSpec, 'value', { label: kind, sensitive: true })}
        onValueChange={() => undefined}
        locale="en"
        revealTimeoutMs={30_000}
      />
    );

    const editable = container.querySelector('input, [contenteditable]');
    expect(editable).not.toBeNull();
    expect(editable?.closest(`.${SENSITIVE_CLASS}`)).not.toBeNull();
    expect(editable?.getAttribute('spellcheck')).toBe('false');
    expect(editable?.getAttribute('data-1p-ignore')).toBe('true');
    expect(editable?.getAttribute('data-gramm')).toBe('false');
  });
});
