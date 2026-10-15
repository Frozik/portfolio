import { ListEditor } from '@frozik/components/components/RichEditor/ListEditor';
import type { ReactNode } from 'react';
import { memo, useEffect, useState } from 'react';

import type { ICardField, TFieldValue } from '@frozik/vault/model/card';
import { isPasswordRotation } from '@frozik/vault/model/card';
import { SENSITIVE_CLASS } from '../sensitive-class';
import { getVaultReactTranslations } from '../translations/translations';
import { SingleValueEditor } from './SingleValueEditor';

function isEmpty(value: string): boolean {
  return value === '';
}

function newItem(): string {
  return '';
}

/**
 * A field's value in its kind's control; a list field is a
 * list of them. A secret multi-line value (a private key) is edited only once
 * shown, as `SecretEditor` cannot hold several lines.
 */
/** A field marked secret is hidden whole from bug-report captures, whatever control shows it. */
function Sensitive({
  sensitive,
  children,
}: {
  readonly sensitive: boolean;
  readonly children: ReactNode;
}) {
  return sensitive ? <div className={SENSITIVE_CLASS}>{children}</div> : children;
}

export const FieldValueEditor = memo(
  ({
    field,
    onValueChange,
    locale,
    revealTimeoutMs,
  }: {
    readonly field: ICardField;
    readonly onValueChange: (value: TFieldValue) => void;
    readonly locale: string;
    /** How long a shown secret stays readable, here and in its control. */
    readonly revealTimeoutMs: number;
  }) => {
    const [shown, setShown] = useState(false);

    useEffect(() => {
      if (!shown) {
        return undefined;
      }
      const timer = setTimeout(() => setShown(false), revealTimeoutMs);
      return () => clearTimeout(timer);
    }, [shown, revealTimeoutMs]);

    const hiddenSecret = field.sensitive && field.spec.kind === 'multiline' && !shown;
    if (hiddenSecret) {
      return (
        <button type="button" aria-pressed={false} onClick={() => setShown(true)}>
          {getVaultReactTranslations(locale).showToEdit}
        </button>
      );
    }
    if (field.value.cardinality === 'single') {
      return (
        <Sensitive sensitive={field.sensitive}>
          <SingleValueEditor
            spec={field.spec}
            value={field.value.value}
            onValueChange={value => onValueChange({ cardinality: 'single', value })}
            label={field.label}
            locale={locale}
            revealTimeoutMs={revealTimeoutMs}
          />
        </Sensitive>
      );
    }
    return (
      <Sensitive sensitive={field.sensitive}>
        <ListEditor<string>
          items={field.value.values}
          onItemsChange={values => onValueChange({ cardinality: 'list', values })}
          createItem={newItem}
          isEmpty={isEmpty}
          locale={locale}
          numbering={
            isPasswordRotation(field)
              ? { first: getVaultReactTranslations(locale).passwordInUse }
              : undefined
          }
          renderItem={(item, index, controls) => (
            <SingleValueEditor
              ref={controls.ref}
              spec={field.spec}
              value={item}
              onValueChange={controls.onChange}
              label={`${field.label} ${index + 1}`}
              locale={locale}
              revealTimeoutMs={revealTimeoutMs}
            />
          )}
        />
      </Sensitive>
    );
  }
);
