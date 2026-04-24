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
            Нажмите на кнопку <strong>Создать новое соревнование</strong>, чтобы начать новый поиск,
            или выберите ранее сохранённый прогон для продолжения.
          </li>
          <li>
            Сверху, на панели <strong>Фитнес-площадка</strong>, будет виден процесс поиска
            нейросети, балансирующей маятник. Кнопкой паузы можно приостановить поиск.
          </li>
          <li>
            В панели <strong>Тестовая площадка</strong> можно попробовать сбалансировать маятник
            самому или посмотреть, как это делает робот, выбранный на панели
            <strong>Поколения</strong>.
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
    createNew: 'Создать новое соревнование',
    continueWith: (dateString: string) => `Продолжить с ${dateString}`,
    columnId: '#',
    columnBestScore: 'Лучший результат',
    columnPlayer: (index: number) => `Игрок #${index}`,
    useRobotInTest: 'Использовать в тестовой площадке',
    viewNeuralNetwork: 'Показать нейронную сеть',
    deleteCompetition: 'Удалить соревнование',
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
