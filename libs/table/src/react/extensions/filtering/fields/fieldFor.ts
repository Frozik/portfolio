import type { TFilterKind } from '../../../../extensions/filtering/model';
import type { TFilterField } from '../filtering-column';
import { BooleanField } from './BooleanField';
import { DateField } from './DateField';
import { EnumField } from './EnumField';
import { NumberField } from './NumberField';
import { SetField } from './SetField';
import { TextField } from './TextField';

const FIELD_BY_KIND: Readonly<Record<TFilterKind, TFilterField<never> | undefined>> = {
  text: TextField,
  number: NumberField,
  date: DateField,
  set: SetField,
  enum: EnumField,
  boolean: BooleanField,
  custom: undefined,
};

export function fieldFor<TRow>(kind: TFilterKind): TFilterField<TRow> | undefined {
  return FIELD_BY_KIND[kind] as TFilterField<TRow> | undefined;
}
