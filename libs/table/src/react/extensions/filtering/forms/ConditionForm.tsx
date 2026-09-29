import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type {
  IDateCondition,
  INumberCondition,
  ITextCondition,
  TConditionModel,
  TJoin,
} from '../../../../extensions/filtering/model';
import {
  DEFAULT_MAX_CONDITIONS,
  isEmptyFilterModel,
  RANGE_OPS,
  VALUELESS_OPS,
} from '../../../../extensions/filtering/model';
import type {
  IConditionFilterOptions,
  IFilterOperator,
} from '../../../../extensions/filtering/spec';
import { useTableContext } from '../../../context';
import {
  dateModel,
  numberModel,
  numberText,
  parseNumber,
  textModel,
  withConditions,
} from '../fields/models';
import type { IFilterEditorContext } from '../filtering-column';
import { useRowKeys } from './useRowKeys';

type TCondition = ITextCondition | INumberCondition | IDateCondition;
type TSpecWithOperators = { readonly operators: readonly IFilterOperator<unknown, TCondition>[] };

const JOINS: readonly TJoin[] = ['and', 'or'];

function emptyModel(kind: TConditionModel['kind'], join: TJoin): TConditionModel {
  switch (kind) {
    case 'text':
      return textModel([], join);
    case 'number':
      return numberModel([], join);
    case 'date':
      return dateModel([], join);
  }
}

function ConditionInputs({
  kind,
  dateInput,
  condition,
  onChange,
}: {
  readonly kind: TConditionModel['kind'];
  readonly dateInput: 'date' | 'datetime-local';
  readonly condition: TCondition;
  readonly onChange: (patch: Partial<ITextCondition & INumberCondition & IDateCondition>) => void;
}) {
  const { translations, numberLocale } = useTableContext();
  if (VALUELESS_OPS.has(condition.op)) {
    return null;
  }
  if (kind === 'text') {
    return (
      <input
        className="ft-filter-input"
        type="text"
        value={'text' in condition ? (condition.text ?? '') : ''}
        onChange={event => onChange({ text: event.target.value })}
      />
    );
  }
  const from = 'from' in condition ? condition.from : undefined;
  const to = 'to' in condition ? condition.to : undefined;
  const inputType = kind === 'date' ? dateInput : 'text';
  const parse = (text: string): number | string | undefined =>
    kind === 'date' ? (text === '' ? undefined : text) : parseNumber(text, numberLocale);
  return (
    <span className="ft-filter-range">
      <input
        className="ft-filter-input"
        type={inputType}
        inputMode={kind === 'number' ? 'decimal' : undefined}
        value={
          from === undefined
            ? ''
            : kind === 'date'
              ? String(from)
              : numberText(Number(from), numberLocale)
        }
        aria-label={translations.from}
        onChange={event => onChange({ from: parse(event.target.value) as never })}
      />
      {RANGE_OPS.has(condition.op) && (
        <input
          className="ft-filter-input"
          type={inputType}
          inputMode={kind === 'number' ? 'decimal' : undefined}
          value={
            to === undefined
              ? ''
              : kind === 'date'
                ? String(to)
                : numberText(Number(to), numberLocale)
          }
          aria-label={translations.to}
          onChange={event => onChange({ to: parse(event.target.value) as never })}
        />
      )}
    </span>
  );
}

/**
 * Up to `maxConditions` operator + value rows joined by and/or, for text,
 * number and date specs. The slice never stores an incomplete model, so the
 * form keeps its own draft: an operator chosen before its value is typed
 * stays chosen.
 */
export const ConditionForm = observer(function ConditionForm<TRow>({
  spec,
  column,
  model,
  set,
}: IFilterEditorContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const kind = spec.kind as TConditionModel['kind'];
  const options = spec.options as IConditionFilterOptions<unknown, TCondition>;
  const operators = (spec as unknown as TSpecWithOperators).operators;
  const maxConditions = options.maxConditions ?? DEFAULT_MAX_CONDITIONS;
  const [draft, setDraft] = useState<TConditionModel | null>(null);
  const lastSent = useRef<TConditionModel | null>(null);

  useEffect(() => {
    if (model?.kind === kind) {
      setDraft(model as TConditionModel);
      return;
    }
    const keepsIncomplete = lastSent.current !== null && isEmptyFilterModel(lastSent.current);
    if (!keepsIncomplete) {
      setDraft(null);
    }
  }, [model, kind]);

  const current: TConditionModel =
    draft ??
    (model?.kind === kind
      ? (model as TConditionModel)
      : emptyModel(kind, options.defaultJoin ?? 'and'));
  const conditions: readonly TCondition[] =
    current.conditions.length === 0
      ? [{ op: options.defaultOp ?? operators[0]?.id ?? '' }]
      : current.conditions;
  const rowKeys = useRowKeys(conditions);

  const commit = (next: TConditionModel): void => {
    setDraft(next);
    lastSent.current = next;
    set(next);
  };
  const update = (next: readonly TCondition[]): void =>
    commit(withConditions(current, next as never));
  const changeJoin = useEventCallback((event: ChangeEvent<HTMLSelectElement>) =>
    commit({ ...current, join: event.target.value as TJoin })
  );
  const addCondition = useEventCallback(() => {
    rowKeys.add();
    update([...conditions, { op: options.defaultOp ?? operators[0]?.id ?? '' }]);
  });
  const removeCondition = (index: number): void => {
    rowKeys.remove(index);
    update(conditions.filter((_, at) => at !== index));
  };
  const clear = useEventCallback(() => {
    setDraft(null);
    lastSent.current = null;
    set(null);
  });

  return (
    <div className="ft-filter-form">
      {rowKeys.rows.map(({ key, item: condition }, index) => (
        <div key={key} className="ft-filter-condition">
          {index > 0 && (
            <select
              className="ft-filter-select ft-filter-join"
              value={current.join}
              onChange={changeJoin}
            >
              {JOINS.map(join => (
                <option key={join} value={join}>
                  {translations[join]}
                </option>
              ))}
            </select>
          )}
          <select
            className="ft-filter-select"
            value={condition.op}
            onChange={event =>
              update(
                conditions.map((item, at) => (at === index ? { op: event.target.value } : item))
              )
            }
          >
            {operators.map(operator => (
              <option key={operator.id} value={operator.id}>
                {translations.filterOps[operator.id] ?? operator.label}
              </option>
            ))}
          </select>
          <ConditionInputs
            kind={kind}
            dateInput={column.kind === 'datetime' ? 'datetime-local' : 'date'}
            condition={condition}
            onChange={patch =>
              update(conditions.map((item, at) => (at === index ? { ...item, ...patch } : item)))
            }
          />
          {conditions.length > 1 && (
            <button
              type="button"
              className="ft-icon-button"
              aria-label={translations.removeCondition}
              onClick={() => removeCondition(index)}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <div className="ft-filter-actions">
        {conditions.length < maxConditions && (
          <button type="button" className="ft-link-button" onClick={addCondition}>
            {translations.addCondition}
          </button>
        )}
        <button type="button" className="ft-link-button" onClick={clear}>
          {translations.clearFilter}
        </button>
      </div>
    </div>
  );
});
