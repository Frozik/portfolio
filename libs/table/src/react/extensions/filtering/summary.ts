import type { TFilterModel } from '../../../extensions/filtering/model';
import { isConditionComplete } from '../../../extensions/filtering/model';
import type { ITableTranslations } from '../../translations/types';

/** Whether the filter row can show the model in its one field, or must show a summary instead. */
export function isSimpleModel(model: TFilterModel | undefined, simpleOp: string): boolean {
  if (model === undefined) {
    return true;
  }
  switch (model.kind) {
    case 'text':
    case 'number':
      return model.conditions.length <= 1 && (model.conditions[0]?.op ?? simpleOp) === simpleOp;
    case 'date':
      return (
        model.conditions.length === 1 &&
        ['between', 'greaterOrEqual', 'lessOrEqual'].includes(model.conditions[0].op)
      );
    default:
      return true;
  }
}

export function summaryOf(model: TFilterModel, translations: ITableTranslations): string {
  switch (model.kind) {
    case 'text':
    case 'number':
    case 'date': {
      const complete = model.conditions.filter(isConditionComplete);
      return translations.filterConditions(complete.length);
    }
    case 'set':
      return `(${model.values.length}) ${model.values.join(', ')}`;
    case 'enum':
      return model.value;
    case 'boolean':
      return model.value ? translations.yes : translations.no;
    case 'custom':
      return translations.filterCustom;
  }
}
