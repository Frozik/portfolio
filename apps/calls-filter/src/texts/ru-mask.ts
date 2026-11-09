import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TMaskToken } from '../contexts/masks/domain/mask-description';
import { plural } from './plural';
import type { ITexts } from './texts';

const count = (value: number, one: string, few: string, many: string) =>
  plural('ru', value, { one: `# ${one}`, few: `# ${few}`, many: `# ${many}`, other: `# ${many}` });

const symbols = (value: number) => count(value, 'символ', 'символа', 'символов');

function times(min: number, max: number | null): string {
  if (max === null) {
    return min === 0 ? 'сколько угодно раз' : `${min} и больше раз`;
  }
  if (min === max) {
    return min === 1 ? 'один раз' : count(min, 'раз', 'раза', 'раз');
  }
  return `${min}–${max} раза`;
}

function describeToken(token: TMaskToken): string {
  switch (token.kind) {
    case 'text':
      return `«${token.text}»`;
    case 'repeat':
      return `«${token.text}» ${times(token.min, token.max)}`;
    case 'any':
      if (token.max === null) {
        return token.min === 0 ? 'что угодно' : `не меньше ${symbols(token.min)}`;
      }
      return token.min === token.max
        ? `любые ${symbols(token.min)}`
        : `любые ${token.min}–${token.max} символа`;
    default:
      return assertNever(token);
  }
}

/** The mask editor's words: the mask read aloud, its errors, its tools. */
export const RU_MASK: ITexts['mask'] = {
  title: 'Маска',
  number: 'Номер',
  name: 'Название',
  field: 'Где искать',
  placeholderNumber: '+7 921 *',
  placeholderName: '*доставка*',
  check: 'Проверить',
  matches: 'подходит',
  noMatch: 'не подходит',
  example: text => `Например: ${text}`,
  describe: (tokens, international) => {
    const parts = tokens.map(describeToken);
    return `${international ? '+' : ''}${parts.join(', затем ')}`;
  },
  error: error => {
    switch (error.kind) {
      case 'empty':
        return 'Маска пустая';
      case 'plus-not-first':
        return `«+» только в начале (позиция ${error.position + 1})`;
      case 'quantifier-without-symbol':
        return `Перед {…} нужна цифра или «.» (позиция ${error.position + 1})`;
      case 'quantifier-after-star':
        return `«*» уже значит «сколько угодно цифр» (позиция ${error.position + 1})`;
      case 'quantifier-malformed':
        return `Повтор пишется как {3}, {1,2} или {2,} (позиция ${error.position + 1})`;
      case 'quantifier-min-above-max':
        return `В {…} первое число больше второго (позиция ${error.position + 1})`;
      case 'unbalanced-parenthesis':
        return `У скобки нет пары (позиция ${error.position + 1})`;
      case 'quantifier-after-parenthesis':
        return `Повтор применяется к одной цифре или «.», не к скобке (позиция ${error.position + 1})`;
      case 'unexpected-character':
        return `Лишний символ (позиция ${error.position + 1})`;
      case 'dangling-escape':
        return '«\\» в конце ничего не экранирует';
      case 'too-long':
        return `В номере не больше ${error.maximum} цифр`;
      default:
        return assertNever(error);
    }
  },
  canonical: error => {
    switch (error.kind) {
      case 'national-prefix-mismatch':
        return `Национальный номер здесь начинается с ${error.nationalPrefix}; или напишите маску с «+»`;
      case 'national-starts-with-wildcard':
        return `Начните национальную маску с ${error.nationalPrefix} или напишите её с «+»`;
      default:
        return assertNever(error);
    }
  },
  startsWith: 'Начинается с',
  contains: 'Содержит',
  exactly: 'Точно',
  anyDigit: '. любая',
  anyRun: '* много',
  repeat: '{…}',
  repeatTitle: 'Повторить символ слева',
  exactlyN: 'Ровно',
  fromTo: 'От – до',
  wholeStar: 'Эта маска берёт всех звонящих: с ней будут конфликтовать все остальные группы',
  matchingCalls: value =>
    `совпадёт с ${count(value, 'звонком', 'звонками', 'звонками')} из журнала`,
};
