import type { versionsTranslationsEn } from './versions-en';

/** Версии, сделанные одновременно в другом месте, и сравнение версий. */
export const versionsTranslationsRu: typeof versionsTranslationsEn = {
  concurrent: {
    message: 'Эту карточку одновременно изменили на другом устройстве.',
    description: 'Обе версии сохранены. Решите, какая остаётся, или объедините их.',
    review: 'Посмотреть',
    title: 'Две версии карточки',
    intro: 'Другая версия отличается от этой:',
    clash: 'Изменено в обеих — выберите, что оставить:',
    thisVersion: 'Эта',
    otherVersion: 'Другая',
    keep: 'Оставить эту версию',
    take: 'Взять другую версию',
    combine: 'Объединить',
    cancel: 'Не сейчас',
  },
  compare: {
    show: 'Сравнить с текущей',
    hide: 'Скрыть',
    before: 'Тогда',
    after: 'Сейчас',
    hidden: 'скрыто',
    empty: 'пусто',
    same: 'Так же, как сейчас.',
  },
};
