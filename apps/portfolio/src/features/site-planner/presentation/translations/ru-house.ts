import type { TranslationOf } from '../../../../shared/i18n/types';
import type { sitePlannerHouseTranslationsEn } from './en-house';

export const sitePlannerHouseTranslationsRu: TranslationOf<typeof sitePlannerHouseTranslationsEn> =
  {
    layers: {
      panelTitle: 'Слои',
      toolTitle: 'Слой',
      menu: 'Выбрать слой',
      names: {
        structure: 'Конструктив',
        walls: 'Стены',
        furniture: 'Мебель',
        electrical: 'Электрика',
        services: 'Инженерные сети',
      },
      show: 'Показать слой',
      hide: 'Скрыть слой',
      activeAlwaysVisible: 'Активный слой всегда виден',
      hideOthers: 'Скрыть остальные слои',
      showAll: 'Показать все слои',
      cycleHint: 'Q — следующий слой · Shift+Q — предыдущий',
      wallsHidden: 'Стены скрыты — проёмы и приборы не найдут стену',
    },
    wiring: {
      routesPanelTitle: 'Трассы',
      materialsPanelTitle: 'Кабельный журнал',
      toolLabel: 'Трасса',
      toolHint:
        'Кликайте по стенам и потолку — точки трассы · Enter или двойной клик — проложить · Backspace — убрать последний изгиб · Esc — отмена.',
      menu: 'Выбрать способ прокладки',
      routeTitle: 'Трасса',
      segmentTitle: 'Участок',
      installationLabel: 'Прокладка',
      levelLabel: 'Идёт',
      levels: {
        ceiling: 'под потолком',
        floor: 'по полу',
      },
      installations: {
        'conduit-16': 'Гофра Ø16',
        'conduit-20': 'Гофра Ø20',
        'conduit-25': 'Гофра Ø25',
        'conduit-32': 'Гофра Ø32',
        chase: 'Штроба',
        trunking: 'Кабель-канал',
        tray: 'Лоток',
        pipe: 'Труба Ø20',
        open: 'Открыто',
      },
      cables: {
        'vvg-3x1.5': 'ВВГнг(А)-LS 3×1.5',
        'vvg-3x2.5': 'ВВГнг(А)-LS 3×2.5',
        'vvg-3x4': 'ВВГнг(А)-LS 3×4',
        'vvg-3x6': 'ВВГнг(А)-LS 3×6',
      },
      cableDefault: 'по потребителям',
      groupTitle: 'Группа',
      consumers: (count: number) => {
        const mod10 = count % 10;
        const mod100 = count % 100;
        const word =
          mod10 === 1 && mod100 !== 11
            ? 'потребитель'
            : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
              ? 'потребителя'
              : 'потребителей';

        return `${count} ${word}`;
      },
      cableLabel: 'Кабель',
      cablesTotal: 'Кабель, с запасом 10 %',
      installationsTotal: 'Прокладка',
      pointsTotal: 'Точки',
      remove: 'Убрать трассу',
      routesEmptyHint:
        'Трасс нет: провода идут вдоль стен. Нарисуйте трассу, чтобы сказать, где кабель пойдёт на самом деле.',
      routeHint: 'Трасса тащится целиком; каждый участок прокладывается по-своему ниже.',
      journalEmptyHint: 'Соедините щиток с потребителями — журнал заполнится сам.',
      assemblyPanelTitle: 'Сборка щита',
      assemblyTitle: (ordinal: number) => `Щиток ${ordinal}`,
      enclosure: (used: number, size: number) => `${used} из ${size} модулей`,
      moduleKinds: {
        incomer: 'Вводной',
        breaker: 'Автомат',
        rcbo: 'Дифавтомат 30 мА',
      },
      purposes: {
        lighting: 'Свет',
        sockets: 'Розетки',
        mixed: 'Розетки и свет',
      },
      assemblyEmptyHint:
        'Повесьте щиток и соедините с ним группы: каждая группа станет автоматом, влажное помещение — дифавтоматом.',
      elevationPanelTitle: 'Развёртка стены',
      elevationWallLabel: 'Стена',
      deviceLetters: {
        panel: 'Щ',
        outlet: 'Р',
        switch: 'В',
        light: 'С',
      },
      elevationEmptyHint: 'Нарисуйте стены — развёртка покажет проёмы, точки на высотах и спуски.',
    },
    storeys: {
      storeyTitle: 'Этаж',
      add: 'Добавить этаж',
      addEmpty: 'Пустой этаж',
      addCopy: 'Скопировать стены этажа ниже',
      referenceToggle: 'Подложка этажа ниже',
      remove: 'Убрать этаж',
      removeKicker: 'УДАЛЕНИЕ',
      removeConfirmTitle: 'Убрать этаж?',
      removeConfirmDescription:
        'Вместе с этажом исчезнут его стены, проёмы, мебель, электрика и лестницы, ведущие на него. Отменить можно через Ctrl+Z.',
      removeConfirm: 'Убрать этаж',
      removeCancel: 'Оставить',
      panelTitle: 'Этаж',
      height: 'Высота этажа',
      floorLevel: 'Отметка пола',
      floorToFloor: 'До отметки выше',
      floorAboveGround: 'Пол над землёй',
      floorLevelAbsolute: 'Абсолютная отметка',
    },
    roof: {
      panelTitle: 'Крыша',
      zoneTitle: 'Зона',
      pitchedTitle: 'Скатная крыша',
      addPitched: 'Сделать скатную',
      removePitched: 'Убрать скатную крышу',
      kinds: {
        gable: 'Двускатная',
        hip: 'Вальмовая',
        shed: 'Односкатная',
      },
      pitch: 'Уклон, °',
      overhang: 'Свес',
      ridge: 'Конёк, °',
      ridgeHeight: 'Конёк над карнизом',
      flatHint:
        'Верх плоский: перекрытие с зонами кровли. Скатная крыша встанет над верхним этажом.',
      covers: {
        membrane: 'Мембрана',
        terrace: 'Терраса',
        green: 'Зелёная кровля',
      },
      emptyHint:
        'Зоны появятся на открытой части перекрытия — там, где над этажом ничего не стоит.',
    },
    openings: {
      menu: 'Выбрать вид проёма',
      panelTitle: 'Проёмы',
      toolLabel: 'Проём',
      toolHint: 'Кликните по стене, чтобы повесить проём; тащите его — он скользит вдоль стены.',
      presetLabel: 'Ставим сейчас',
      presets: {
        door: 'Дверь',
        window: 'Окно',
        panoramic: 'Окно в пол',
      },
      kinds: {
        door: 'Дверь',
        window: 'Окно',
      },
      offset: 'По стене',
      width: 'Ширина',
      sill: 'Подоконник',
      head: 'Верх',
      hint: 'Проём скользит вдоль своей стены; Delete удаляет его.',
    },
    rooms: {
      panelTitle: 'Комнаты',
      roomTitle: 'Комната',
      unassigned: '—',
      wet: 'мокрая зона',
      emptyHint: 'Комнаты появятся, когда стены разделят пятно застройки.',
      types: {
        living: 'Гостиная',
        bedroom: 'Спальня',
        kitchen: 'Кухня',
        bathroom: 'Санузел',
        boiler: 'Котельная',
        sauna: 'Сауна',
        garage: 'Гараж',
        hall: 'Прихожая',
        dining: 'Столовая',
        wardrobe: 'Гардеробная',
        laundry: 'Прачечная',
        office: 'Кабинет',
        pantry: 'Кладовая',
        veranda: 'Веранда',
      },
    },
    walls: {
      panelTitle: 'Стены',
      wallTitle: 'Стена',
      toolLabel: 'Стена',
      toolHint: 'Кликами наметьте линию стены; Enter или двойной клик завершают её.',
      traceOutline: 'Стена по контуру',
      traceOutlineHint:
        'Замкнутая стена вдоль контура основания этажа одним нажатием — для круглого дома это весь периметр сразу.',
      drawHint:
        'Кликами наметьте линию; клик в первую точку замыкает контур. Enter или двойной клик завершают стену, Esc отменяет.',
      modifierHint:
        'Цифры — точная длина сегмента · Shift — фиксация угла с шагом 15° · Alt — отключить все привязки (углы стен, точки основания, дуга круга, сетка). Курсор сам ловит углы, квадранты круга и скользит по его дуге.',
      junctionHint:
        'Узел выбран, рёбра пронумерованы. Цифра — удалить ребро · D + цифра — оторвать ребро от узла и перенести (клик ставит) · S — разрезать стену в узле · Esc — снять выбор.',
      material: 'Материал',
      materials: {
        brick: 'Кирпичная кладка',
        'ceramic-block': 'Керамоблок',
        'foam-concrete': 'Пенобетон',
        timber: 'Брус',
        frame: 'Каркас',
        glazing: 'Витраж',
      },
      thickness: 'Толщина',
      referenceLine: 'Опорная линия',
      referenceLines: {
        'outer-face': 'Внешняя грань',
        centerline: 'Осевая',
      },
      remove: 'Убрать стену',
      contour: 'Контур',
      contourClosed: 'замкнут',
      closeRing: 'Замкнуть контур',
      hint: 'Квадраты двигают углы — конец, притянутый к другому концу, замыкает контур · кольца добавляют угол · двойной клик убирает угол · Alt+двойной клик разрезает стену в нём · Delete убирает стену целиком.',
      closedHint:
        'Контур замкнут: последний угол соединён с первым. Alt+двойной клик по углу разрезает кольцо в нём.',
      emptyHint:
        'Стен пока нет — инструмент «Стена» (W) рисует их кликами по опорной линии; линия, замкнутая кликом в начало, становится контуром.',
    },
    house: {
      title: 'Строения',
      nameLabel: 'Название строения',
      padModeLabel: 'Отметка основания',
      padModes: {
        'terrain-center': 'Рельеф в центре',
        'terrain-mean': 'Среднее по рельефу',
        'terrain-min': 'Минимум по рельефу',
        manual: 'Вручную',
      },
      padElevation: 'Основание',
      padDrop: 'Опустить на',
      wallHeight: 'Стены',
      earthworks: 'Земляные работы',
      cut: 'Срезка',
      fill: 'Подсыпка',
      cubicMeterUnit: 'м³',
      foundation: {
        title: 'Фундамент',
        kindLabel: 'Тип',
        kinds: {
          slab: 'Плита',
          'stem-wall': 'Лента',
          pier: 'Столбы',
        },
        depth: 'Заглубление',
        plinth: 'Цоколь',
        volume: 'Бетон',
        volumeNotEstimated: '—',
      },
      entries: {
        title: 'Вводы',
        add: 'Добавить ввод',
        editorHint:
          'Клик выбирает ввод, Delete убирает. Перетаскивание у края скользит по контуру, утащенный внутрь пятна ввод уходит через плиту фундамента (газ — только по фасаду). Отсюда разводятся внутренние сети, снаружи к вводам примагничиваются траншеи.',
        offset: 'По контуру',
        floorX: 'В плите · X',
        floorY: 'В плите · Y',
        throughFloor: 'через плиту',
        depth: 'Глубина',
        facadeHeight: 'Высота',
        remove: 'Убрать ввод',
        kinds: {
          sleeve: 'гильза',
          facade: 'по фасаду',
        },
        systems: {
          power: 'Электричество',
          network: 'Интернет',
          water: 'Вода',
          sewer: 'Канализация',
          heating: 'Отопление',
          ventilation: 'Вентиляция',
          gas: 'Газ',
        },
      },
    },
  };
