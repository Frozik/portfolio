import type { TranslationOf } from '../../../../shared/i18n/types';
import type { controlsTranslationsEn } from './en';

export const controlsTranslationsRu: TranslationOf<typeof controlsTranslationsEn> = {
  lobby: {
    sectionKicker: 'контролы',
    headlinePrimary: 'Интерактивные',
    headlineAccent: 'контролы',
    heroSubtitle:
      'Пара базовых полей ввода, которые я переделываю в каждом проекте — числовой редактор с подсветкой PIP и пикер даты/времени со свободным парсингом.',
  },
  datePage: {
    sectionKicker: 'дата / время',
    title: 'Выбор даты / времени',
    description:
      'Умный ввод даты с всплывающим календарём и разбором свободного текста. Используйте',
    stepInstruction: 'для изменения значения. Поддерживаемые форматы:',
    categories: {
      keywords: 'Ключевые слова:',
      boundaries: 'Границы:',
      weekdays: 'Дни недели:',
      offsets: 'Смещения:',
      dates: 'Даты:',
      months: 'Месяцы:',
      quarters: 'Кварталы:',
      ordinals: 'Порядковые:',
      time: 'Время:',
      dateTime: 'Дата + время:',
    },
    arrowKeyStep: 'Шаг клавиш-стрелок',
    stepMinute: 'Минута',
    stepHour: 'Час',
    stepDay: 'День',
    stepWeek: 'Неделя',
    timePrecision: 'Точность времени',
    resolutionMinutes: 'Минуты',
    resolutionSeconds: 'Секунды',
    resolutionMilliseconds: 'Миллисекунды',
    parseDirection: 'Направление разбора',
    futureOnly: 'Только будущее',
    nearest: 'Ближайшее',
    nearestHint: 'Ближайшее совпадение \u2014 "13:00" разрешается в сегодня, даже если уже прошло',
    futureHint: 'Только будущее \u2014 "13:00" переносится на завтра, если уже прошло',
    placeholder: 'Введите дату (tomorrow 13:00, mon 9am, 2024-01-15...)',
    resolvedValue: 'Результат',
    resolvedKicker: 'результат',
  },
  numberPage: {
    sectionKicker: 'числовой ввод',
    title: 'Курс / Сумма / Число',
    description:
      'Числовой ввод с настраиваемой точностью десятичных знаков и подсветкой PIP. Полезен для конверсионных курсов и финансовых данных.',
    suffixHint: 'суффиксы поддерживаются.',
    pipStartSize: 'PIP начало + размер',
    decimals: 'Десятичные знаки',
    placeholder: 'Введите конверсионный курс',
  },
};
