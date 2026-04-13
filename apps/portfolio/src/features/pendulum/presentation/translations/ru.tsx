import type { TranslationOf } from '../../../../shared/i18n';
import type { pendulumTranslationsEn } from './en';

export const pendulumTranslationsRu: TranslationOf<typeof pendulumTranslationsEn> = {
  fitnessPlayground: {
    competitionNotStarted: 'Соревнование не запущено',
    description: (
      <>
        <p>
          Эта демонстрация использует генетический алгоритм для эволюции весов нейронной сети,
          балансирующей перевёрнутый маятник вокруг нулевой отметки.
        </p>
        <ul>
          <li>
            Откройте вкладку <strong>Поколения</strong> и нажмите <strong>Создать новое</strong>,
            чтобы начать новый поиск, или выберите ранее сохранённый прогон для продолжения.
          </li>
          <li>
            Функция приспособленности запускается на паузе — нажмите кнопку{' '}
            <strong>воспроизведения</strong> для начала эволюции.
          </li>
          <li>
            Таблица поколений ранжирует нейронные сети по оценке приспособленности. Выберите любую
            сеть для просмотра во вкладках <strong>Тестовая площадка</strong> или{' '}
            <strong>Нейронная сеть</strong>.
          </li>
          <li>
            Во вкладке тестирования можно применить внешнюю силу, кликнув, удерживая и перетаскивая
            к грузу маятника.
          </li>
        </ul>
        <p>
          Скорость симуляции автоматически адаптируется к доступной производительности CPU, сохраняя
          отзывчивость интерфейса.
        </p>
      </>
    ),
  },
  generationsList: {
    createNew: 'Создать новое',
    continueWith: (dateString: string) => `Продолжить с ${dateString}`,
    columnId: '#',
    columnBestScore: 'Лучший результат',
    columnPlayer: (index: number) => `Игрок #${index}`,
  },
  neuralNetwork: {
    selectRobotMessage: 'Выберите робота для отображения структуры нейронной сети и её весов',
  },
  tabs: {
    fitnessPlayground: 'Фитнес-площадка',
    generations: 'Поколения',
    testPlayground: 'Тестовая площадка',
    neuralNetwork: 'Нейронная сеть',
  },
};
