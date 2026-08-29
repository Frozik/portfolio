# Аудит `apps/portfolio/src` — 2026-08-29

Полное ревью кодовой базы (~123 000 строк, из них ~24 800 — данные уровней tanks)
на соответствие архитектурным стандартам проекта (CLAUDE.md), принципам единой
ответственности, читаемости и современным практикам. Ревью выполнено по слоям и
фичам; DDD-чистота domain-слоёв проверена грепами (React/MobX/RxJS в `domain/`
отсутствуют во всех фичах).

**Статусы**: `[ ]` — не начато, `[x]` — сделано, `[~]` — сделано частично (см. примечание).

**Общий вердикт**: база в очень хорошем состоянии. Слои выдержаны, MobX-конвенции
соблюдены, ресурсы освобождаются дисциплинированно, реальных `any` нет, `Date` не
используется, suppressions только с обоснованием. Основные долги: файлы-тысячники,
дублирование между парами похожих фич, несколько точечных багов и локальные
отступления от конвенций.

---

## P0 — Баги и точечные исправления

### [x] 1. timeseries: необработанный отказ WebGPU-адаптера — HIGH

> Сделано: контекст несёт `'initializing' | 'ready' | 'unsupported'`, `.catch` →
> unsupported; фоллбэк вынесен в `shared/components/WebGpuUnsupportedNotice.tsx`
> (WebGpuGuard стал тонким, его API не менялся); Timeseries показывает notice.

`features/timeseries/presentation/SharedRendererContext.tsx:19`

- **Проблема**: `void createSharedRenderer().then(...)` без `.catch`.
  `createSharedRenderer` кидает `assert`, когда `navigator.gpu.requestAdapter()`
  возвращает `null` (реальный случай: WebGPU объявлен, но адаптер недоступен —
  Linux, старые GPU, software-rendering). Итог — unhandled promise rejection и
  навсегда пустые графики без какого-либо сообщения пользователю.
- **Исправление**: добавить состояние `'unsupported'` в контекст (по образцу
  `markUnsupported` из binance-view), `.catch` переводит контекст в это состояние,
  презентация показывает существующий `WebGpuGuard`/fallback. Заодно переименовать
  переменную `r` (запрет однобуквенных имён).

### [x] 2. sudoku: скрытая мутация в domain-редьюсере + `cloneDeep`-страховка — HIGH

> Сделано, с уточнением: исходная гипотеза оказалась неточной —
> `applyToolToFieldReducer` уже копировал ячейку с `notes` (проверено frozen-тестом).
> Реальные проблемы: `validateField` пересоздавал ВСЕ ячейки (identity churn →
> лишние ре-рендеры) — теперь копирует только изменившие статус; `loadField`
> мутировал `cell.type` in place — переписан иммутабельно. Оба `cloneDeep`
> из store убраны, история делит структуру с живым полем. Добавлены 3 теста
> (deep-freeze-иммутабельность, переиспользование ячеек, независимость снапшотов).

`features/sudoku/domain/services.ts:119-141`, `features/sudoku/application/SudokuStore.ts:70-73`

- **Проблема**: `applyToolToFieldReducer` шэллоу-копирует поле, но мутирует
  вложенные `notes` через разделяемые ссылки. Комментарий в store прямо признаёт
  это, и store защищается `cloneDeep` всего поля перед каждым ходом. Это костыль:
  «редьюсер» нечист, история ходов оплачивается полным глубоким копированием.
- **Исправление**: сделать редьюсер по-настоящему иммутабельным — копировать
  только затронутые ячейки вместе с их `notes` (structural sharing). Убрать
  `cloneDeep` и оправдывающий его комментарий из store. История получит
  структурное разделение бесплатно.

### [x] 3. pendulum: бизнес-логика в presentation-хуке — HIGH

> Сделано: use-case `application/createFitnessCompetition.ts`; схема modelUrl —
> `buildRobotModelUrl` в `IndexedDBGenerationsRepository`; store держит
> `competition` через `reaction` на `competitionStart`; `useCompetition` — 6
> строк. Закрыт риск: генерации читаются лениво в `init()`, а не снапшотом.

`features/pendulum/presentation/hooks/useCompetition.ts:63-95`

- **Проблема**: генерация competition, персистенс и схема URL модели
  (`indexeddb://${competition.start}-player-${name}`) собраны в presentation-хуке.
  Схема адреса — знание infrastructure, оркестрация — application. Единственное
  системное нарушение направления слоёв `presentation → application → domain` в
  четырёх фичах (pendulum/sudoku/welcome/controls).
- **Исправление**: фабрику competition перенести в application
  (метод `PendulumStore` или отдельный use-case), формирование modelUrl — в
  `IndexedDBGenerationsRepository`. Хук остаётся тонким адаптером к store.

### [x] 4. retro: сырые строковые Yjs-ключи вперемешку с константами — MEDIUM

> Сделано: все 11 сырых ключей → константы `YJS_GROUP_FIELD_*` (они уже были в
> `domain/yjs-schema.ts` — аудит ошибочно поместил файл в infrastructure).
> Греп подтверждает: сырых Y.Doc-ключей в фиче не осталось.

`features/retro/application/RoomStore.ts:605` (константа) vs `:688, :729-732, :755, :1148-1151` (сырые `'cardIds'`, `'id'`, `'columnId'`, `'title'`)

- **Проблема**: константы полей есть в `yjs-schema.ts`, но применяются
  непоследовательно. Опечатка в строковом ключе = молчаливая порча CRDT-данных
  без единой ошибки.
- **Исправление**: везде использовать константы из `yjs-schema.ts`; при
  необходимости дополнить схему недостающими именами полей.

### [x] 5. sudoku: контролы недоступны с клавиатуры + сопутствующие проблемы — MEDIUM

> Сделано: все контролы — `<button type="button">` (+ `aria-pressed`,
> `aria-label` через новые ключи переводов en/ru); выделен `ToolValueButton`
> (memo + useFunction, типизированный `value` вместо dataset); индексы —
> `groupIndex`/`valueIndex` (не row/column — внешний map даёт блоки, не ряды);
> `toolType` derive из `tool.type` c локальным `preferredToolType` только для
> состояния None (иначе toggle Notes/Pen был бы no-op без выбранной цифры).
> Осталось глянуть доску в браузере — div→button проверен типами/prefight, не
> пикселями.

`features/sudoku/presentation/components/FieldControls.tsx`

- **Проблемы**:
  - все контролы — кликабельные `<div onClick>` без `role`, `tabIndex`,
    keyboard-обработки (`:101-222`) — недоступно с клавиатуры и для скринридеров;
  - вложенные `.map(index => ...)` с затенением внешнего `index` (`:84, :97`);
  - значение инструмента гоняется через `data-value` → `event.target.dataset` с
    нетипизированным event и риском `parseInt(undefined)` (`:51-56`);
  - локальный state `toolType` дублирует `tool.type` из store (`:47-49`) — при
    внешнем сбросе инструмента локальное состояние разъезжается со store.
- **Исправление**: перевести на `<button type="button">` с текущими классами;
  выделить ячейку-контрол в дочерний компонент с типизированным пропсом `value` и
  `useFunction`-колбэком (dataset-раунд-трип не нужен); переименовать индексы
  (`rowIndex`/`columnIndex`); `toolType` derive из `tool.type`.

### [x] 6. stereometry: drag-connector не обрабатывает `pointercancel`/`blur` — MEDIUM

> Сделано: `pointercancel` + `window.blur` → `cancelInteraction()` с отпиской в
> cleanup; в `click-detector.ts` добавлен только `pointercancel`-сброс (blur там
> менял бы семантику клика — осознанно пропущен).

`features/stereometry/infrastructure/drag-connector.ts:377-379` (+ в меньшей степени `click-detector.ts`)

- **Проблема**: `cancelInteraction()` есть, но вызывается только при появлении
  второго пойнтера. Если ОС отменяет пойнтер (системный жест на тачскрине),
  `pointerup` не приходит — `activeHit` и превью-линия зависают до следующего тапа.
- **Исправление**: подписаться на `pointercancel` и `window.blur` с вызовом
  `cancelInteraction()` (по аналогии с камерой stereometry); не забыть отписку в
  dispose. Проверить `click-detector.ts` на тот же класс проблем.

### [x] 7. stereometry: лживый комментарий о GPU-layout в hard-won коде — MEDIUM

> Сделано: комментарий переписан на «24 floats (96 bytes)» со сверкой по WGSL
> (22 float в `LineInstance` + 2 vertex-index атрибута). Код не тронут.

`features/stereometry/infrastructure/layers/scene-layer.ts:911-914`

- **Проблема**: докстрока `applyStyledSegments` утверждает «Each segment is 32
  floats (128 bytes)», фактический stride — `FLOATS_PER_STYLED_LINE = 24`
  (96 байт, `scene-layer.ts:66`). В файле, где ручные std140-офсеты — главный
  источник риска, устаревшая спецификация в комментарии опасна.
- **Исправление**: исправить только цифры в комментарии. Код корректен — не
  трогать (occlusion-пайплайн hard-won, правки только с визуальной проверкой).

### [x] 8. retro: таймер без cleanup и неверный текст тоста — MEDIUM

> Сделано: общий хук `shared/hooks/useCopyToClipboard.ts`
> (idle/copied/failed, таймер чистится на unmount и повторном клике);
> ExportDialog на хуке, тост — новый ключ `close.markdownCopied` (en+ru).
> Попутно тот же незакрываемый setTimeout ушёл из ShareLinkDialog.

`features/retro/presentation/components/ExportDialog.tsx:57-60`

- **Проблемы**: `setTimeout(() => setCopied(false), ...)` не очищается при
  unmount (нарушение правила cleanup); при копировании markdown показывается
  `t.room.linkCopied` («ссылка скопирована») — неверный текст.
- **Исправление**: очистка таймера в `useEffect`-cleanup (или `useRef` +
  clearTimeout при повторном клике и unmount); отдельный ключ перевода для
  «markdown скопирован».

### [x] 9. graphics: `dispose()` уничтожает чужой буфер — MEDIUM

> Сделано: destroy перенесён в cleanup `application/render/chart-draw.ts` после
> `layerManager.dispose()` (ровно один раз, после dispose обоих слоёв).

`features/graphics/infrastructure/layers/composite-layer.ts:125-127`

- **Проблема**: `CompositeLayer.dispose()` уничтожает `compositeUniformBuffer`,
  созданный в `createCompositeLayerResources` и используемый также `SinYLayer`.
  Работает лишь потому, что dispose случается при полном teardown, но нарушает
  принцип «владелец создаёт — владелец уничтожает».
- **Исправление**: destroy буфера перенести к создателю — в cleanup
  `chart-draw.ts:95-102`.

### [x] 10. pendulum: небезопасный опциональный `crossoverModels?` — MEDIUM

> Сделано: обычный метод (и в `IRobotPlayer`), `instanceof` с явным fallback,
> предвалидация топологии (слои/тензоры/shape) с выделенной
> `IncompatibleModelTopologyError` — только она деградирует в mutate, остальное
> пробрасывается; заодно устранён double-dispose риск `childModel`.

`features/pendulum/domain/players/TensorflowPlayer.ts:178-186`

- **Проблема**: `crossoverModels?` — опциональный метод класса с непроверенным
  даункастом `(secondParent as TensorflowPlayer)` и `catch {}`, который молча
  деградирует в мутацию при ЛЮБОЙ ошибке, а не только при несовместимых слоях.
- **Исправление**: сделать обычным методом; `instanceof TensorflowPlayer` с
  явным fallback; catch — только ожидаемой ошибки несовместимой топологии.

### [x] 11. conf: результат копирования ссылки молча глотается — LOW

> Сделано: ShareLinkDialog сам копирует и показывает исход на кнопке
> (Check/X + подписи), наружу — `onCopyResult`; conf показывает ошибку через
> существующий ключ `errors.copyFailed`, retro сохранил свой тост.

`features/conf/presentation/ConfRoom.tsx:110-112`

- **Проблема**: `void copyToClipboard(...)` — при неудаче пользователь ничего не
  узнаёт; retro в той же ситуации показывает toast. Несогласованный UX между
  фичами, решающими одну задачу.
- **Исправление**: показать результат копирования (успех/ошибка) — согласовать с
  retro; в идеале `ShareLinkDialog` сам отображает фидбек.

### [x] 12. shared/communication: `disconnect()` ломает контракт на повторный `connect()` — MEDIUM

> Сделано: guard (`connect()` после `disconnect()` бросает
> `communication-client/disposed`; refcounted-пул делает disconnect терминальным
> по факту — задокументировано в JSDoc), `disconnect()` идемпотентен;
> `stateChangeSubject` удалён в пользу `state$.pipe(skip(1))`; +2 теста,
> существующие утверждения не ослаблены.

`shared/communication/CommunicationClient.ts:250-259`

- **Проблема**: `disconnect()` комплитит все subjects; последующий `connect()`
  создаст новый сокет, но события лягут в мёртвые subjects — молча перестанут
  доходить. Путь сейчас недостижим благодаря пулу, но интерфейс его допускает.
- **Исправление**: guard (ошибка при `connect()` после `disconnect()`) либо
  пересоздание subjects. Заодно: `stateChangeSubject` дублирует
  `stateSubject` (BehaviorSubject) — `onConnectionStateChange` реализуем через
  `state$.pipe(skip(1))` (`:127-128`).

### [x] 13. sun: камера не получила фиксы багов stereometry-камеры — MEDIUM

`features/sun/infrastructure/sun-camera-controller.ts:118`

- **Проблема**: в stereometry-контроллере (`camera-controller.ts:155-159,
  234-238`) есть `setPointerCapture` (иначе потеря `pointerup` за окном браузера
  «залипляет» вращение), сброс пойнтеров по `window.blur` и общий
  `computePinchScale` (защита от вырожденного pinch). Sun-версия: делит pinch
  «в лоб» (`lastPinchDistance / currentDistance` — деление на ноль при
  совпадении пальцев), не имеет ни capture, ни blur-обработчика. Класс багов
  воспроизводится в sun. Плюс путаница: два разных интерфейса с одним именем
  `OrbitalCameraController`.
- **Исправление (минимум, P0)**: портировать в sun `setPointerCapture`,
  blur-сброс и `computePinchScale`.
- **Исправление (полное, см. P2, пункт 32)**: общий pointer/gesture-трекер в
  `@frozik/utils/webgpu`, оба контроллера собираются на нём.
- **Статус**: минимум выполнен — `setPointerCapture`, blur-сброс скоростей и
  пойнтеров, `computePinchScale` из `@frozik/utils/webgpu/pinchScale` (хелпер
  уже существовал). Пункт закрыт как P0; полная унификация — пункт 32.

### [x] 14. app: `GameOfLifeBackground` дублирует canvas-lifecycle мимо `useAmbientCanvas` — MEDIUM

> Сделано: симуляция+painter вынесены в `game-of-life-animation.ts`
> (IAmbientCanvasAnimation, троттлинг шага через аккумулятор deltaMs, repaint
> только при шаге/resize); компонент — 14 строк на `useAmbientCanvas`. Бонусом
> получил ResizeObserver и паузу offscreen.

`app/components/GameOfLifeBackground.tsx`

- **Проблема**: компонент вручную реализует весь lifecycle (DPR-клэмп,
  reduced-motion, visibility-pause, resize), который специально вынесен в
  `shared/hooks/useAmbientCanvas.ts` и используется шестью другими анимациями.
  Причём хуже эталона: `window.resize` вместо `ResizeObserver` (не среагирует на
  изменение размера контейнера без ресайза окна) и нет паузы offscreen.
- **Исправление**: разбить по принятому паттерну — `game-of-life-animation.ts`
  (чистая симуляция + painter, контракт `IAmbientCanvasAnimation`) + компонент,
  использующий `useAmbientCanvas`. Троттлинг шага (450 мс) реализуется через
  `elapsedMs`/аккумулятор в draw.

### [x] 15. binance-view: inline-arrow в `.map` — LOW

> Сделано: `InstrumentOption` (memo + useFunction).

`features/binance-view/presentation/InstrumentSelector.tsx:33`

- **Проблема**: `onSelect={() => handleSelect(option.symbol)}` внутри `.map` —
  нарушение конвенции «no inline arrow callbacks».
- **Исправление**: выделить элемент списка в дочерний компонент с
  `useFunction`-колбэком.

### [ ] 16. Мелочи одним проходом — LOW

- [x] `features/scorched/domain/round.ts:163-173` — собственный Fisher-Yates:
  заменён на `shuffle` из `lodash-es` (seeded RNG не использовался — проверено).
- [x] `features/scorched/application/ScorchedStore.ts:780-789` — `throw new Error`
  → `assert(!isNil(round), ...)` из `@frozik/utils/assert/assert`.
- [x] `features/scorched/presentation/components/ScorchedGame.tsx:33-34` — две
  нулевые константы схлопнуты в `NO_DESCENT_SPEED`, сравнение переписано через
  именованный флаг `isDescending`.
- [x] `features/binance-view/application/chart-state.ts:68-80, 242` —
  `throw new Error` → `assert`; `get viewport(): IHeatmapViewport`.
- [x] `TradesStreamStore.handleFlush:327`, `OrderbookStreamStore.handleFlush:220`
  — избыточный `runInAction` убран (проверено isAction-пробой: autoBind делает
  приватные методы bound-actions); `runInAction` после `await` оставлены.
- [x] `features/timeseries/presentation/Timeseries.tsx:34-48` — пороги →
  `VALUE_THRESHOLD_HIGHEST/HIGH/MEDIUM/LOW` (делятся линией и ромбом).
- [x] `features/pendulum/application/PendulumStore.ts:271-274` — обёртка
  `matchValueDescriptor(createSyncedValueDescriptor(...) as ...)` ради обёртки →
  `starts.length > 0 ? createSyncedValueDescriptor(starts) : EMPTY_VD`.
- [x] `features/pendulum/domain/Playground.ts:284` — `.map()` ради сайд-эффекта →
  `forEach`; `_gravity` → `gravity` (коллизии не было).
- [x] `features/sudoku/domain/services.ts:82` — `convertErrorToFail(error as
  Error)` → `toFail(error)` без каста.
- [x] `features/pendulum/presentation/components/GenerationsList.tsx:36` —
  `DATE_LOCALE` → ленивое `getDateLocale()`; `i` → `playerIndex`.
- [x] `features/controls/presentation/components/DatePage.tsx:275` —
  `value !== undefined` → `!isNil(value)`.
- [x] `features/pendulum/presentation/hooks/useFrameTicker.ts:40-44` —
  `else if (fps >= MIN_FPS)` всегда истинно → `else`.
- [x] `features/graphics/infrastructure/chart-textures.ts:9` —
  `compositeUniformBuf` → `compositeUniformBuffer` (запрет аббревиатур).
- [x] `features/graphics/infrastructure/layers/shapes-layer.ts:17-27` — импорты
  сгруппированы сверху, дублирующий импорт устранён.
- [x] `features/graphics/infrastructure/layers/sin-y-layer.ts:18-25` —
  конструктор принимает `resources: CompositeLayerResources` (4 аргумента).
- [x] `features/sun/infrastructure/layers/sun-layer.ts:128` — depth-view
  кэшируется (`ensureDepthView`), `createView()` не на каждый кадр.
- [x] Исторические комментарии удалены (`representation.ts`,
  `sun-camera-controller.ts`); докстрока `resolveStyle` перенесена к своей
  функции (`styles-processor.ts`).
- [x] НОВОЕ (найдено при реализации): `stereometry/domain/styles-processor.ts`
  (~строка 181) — литеральный NUL-байт в ключе кэша заменён на escape `'\0'`,
  файл снова текстовый для git/grep; тесты зелёные.
- [x] `features/binance-view` / `features/timeseries` — все 28 ссылок на
  несуществующие план-документы в 15 файлах заменены самодостаточными
  формулировками (суть ограничений сохранена).
- [x] `app/components/TopNav.tsx:32-51` — `IconQR` вынесен в
  `src/icons/SvgQrCode.tsx` по образцу `SvgGitHub`.
- [x] НОВОЕ: NUL-байт в `styles-processor.ts` заменён на `'\0'`-escape — файл
  снова текстовый для git/grep (см. пункт в списке выше).

---

## P1 — Файлы-тысячники: разбиение по единой ответственности

Все разбиения ниже не меняют публичные API; существующие тесты защищают
конвертацию.

### [x] 17. `features/retro/application/RoomStore.ts` (1204 строки) — god-object

> Сделано: RoomStore 1206→632 (makeAutoObservable с типизированным generic,
> без `as never`); новые `infrastructure/RetroDocGateway.ts` (621, чистый Yjs,
> +302 строки тестов — 18 шт.), `application/PresenceTracker.ts` (170),
> `application/TimerCueController.ts` (73), аксессор retroLobbyStore. Room.tsx
> 243→184. 73 теста зелёные (55 старых не тронуты). dispose сверен 1:1.

Шесть различимых ответственностей в одном классе:
(a) чтение Y.Doc в снапшот (`buildSnapshot`/`readMeta`/`readCards`/`readGroups`/`readVotes`, `:1052-1203`);
(b) все Yjs-мутации карточек/групп/голосов/таймера (`:485-978`);
(c) presence + дедупликация awareness + запись в UserDirectory (`:401-444`);
(d) звуковые cue таймера (`:281-314`);
(e) UI-state диалогов/тостов (`:446-483`);
(f) lifecycle/инициализация.

- **План**:
  - `infrastructure/RetroDocGateway.ts` — все операции чтения/записи Y.Doc (не
    зависят от MobX, тестируются без store);
  - `application/PresenceTracker.ts` — дедуп awareness + upsert в директорию;
  - `application/TimerCueController.ts` — звуковые cue;
  - `RoomStore` — тонкий MobX-фасад.
- **Бонус**: уйдёт 50-строчная ручная карта `makeObservable` (`:157-209`) —
  вернётся конвенционный `makeAutoObservable` (сейчас новый метод молча не
  становится action — ловушка сопровождения).
- **Примечание**: делать вместе с пунктом 26 (computed `presentParticipantIds`).

### [x] 18. `features/scorched/domain/round.ts` (1573 строки)

> Сделано: round.ts 1561→909; новые `projectile-flight.ts` (539, экспорт только
> `advanceProjectile` + контекст), `impact-resolution.ts` (227, экспорт только
> `detonate`), `round-inventory.ts` (95, класс `RoundInventories`),
> `tank-geometry.ts` (28, общая геометрия трёх модулей). Публичный API не
> изменён — `round.test.ts` не тронут, 435 тестов зелёные; madge циклов нет.

Класс `ScorchedRound` когезивен, но несёт четыре ответственности. Разбиение без
изменения публичного API:

- `domain/round-inventory.ts` — класс `RoundInventories`
  (`toMutableInventory`, `consumeAmmo`, `consumeItem`, `consumeContactTrigger`,
  `getAmmoCount`, `getItemCount`, `getRemainingInventory`; `:128-153, 630-665`);
- `domain/projectile-flight.ts` — чистые функции полёта снаряда
  (`advanceProjectile`, `beginRolling`, `rollProjectile`,
  `detonateRollerOnContact`, `beginPouring`, `pourLiquidDirt`,
  `steerProjectile`, `splitMirvAtApex`, `updateMuzzleClearance`,
  `findStruckTank`; `:788-1247`);
- `domain/impact-resolution.ts` — разрешение попаданий/эффектов
  (`detonate`, `applyEffect`, `carve`, `noteSettling`, `applyExplosion`,
  `applyTankFalls`; `:1249-1502`);
- остаток (ход/фазы/aim/fire, ~500 строк) — читаемое ядро.

### [x] 19. `features/scorched/application/ScorchedStore.ts` (1083 строки)

> Сделано: ScorchedStore 1082→892; `ShopStore` (196, узкие аксессоры вместо
> ссылки на store) и `OverlayStore` (123). Presentation читает под-store'ы
> напрямую (`store.shop.*`, `store.overlays.*`), мёртвых прокси нет; владение
> статусом осталось в фасаде. 435/435 тестов, правки тестов — только call-site
> переименования.

Store — фасад над match/round, паттерн правильный, но две области автономны:

- `application/ShopStore.ts` — `shopPlayerId`, `shopCart`, `shopQueue`, `buy`,
  `sell`, `getOwnedCount`, `isShopEntryUnlocked`, `openNextShop`,
  `runAiShopping` (`:418-496, 791-855`);
- `application/OverlayStore.ts` — эфемерные оверлеи: `damagePopups`, `taunts`,
  `pushHealthPopup`, `pushTaunt`, `ageOverlays` (`:953-1003`).

### [x] 20. `features/welcome/.../projects/fx/effects.ts` (1111 строк)

> Сделано: 12 файлов `fx/effects/draw-*.ts` + `fx/effect-registry.ts` с
> хелперами `createStatelessFxEffect`/`createStatefulFxEffect<TState>` — все
> касты state ушли, мешок `Record<string, unknown>` заменён владением состояния
> самим эффектом. Тела draw-функций сверены с оригиналом побайтово. Осталось
> (LOW, вне скоупа переноса): короткие имена `i/j/v/m1/p1` внутри
> `draw-rotate.ts`/`draw-peers.ts` из исходного порта.

12 независимых draw-функций в одном файле + нетипизированный
`state: Record<string, unknown>` с `as`-кастами (`state.shapes as
IFloatingShape[]`).

- **План**: `fx/effects/drawNeural.ts`, `drawShapes.ts`, … (по файлу на эффект) +
  генерик `TFxDraw<TState>` с типизированным state на эффект. Инлайн-числа
  легитимированы шапкой (порт дизайн-референса) — оставить. Ориентир стиля —
  `hero-orderbook-animation.ts` / `controls-background-animation.ts`.

### [x] 21. `features/timeseries/application/render/chart-state.ts` (694 строки)

> Сделано: 694→298; `domain/axis-draw/` (axes/grid/shared по образцу
> binance-view, X/Y-циклы свёрнуты в `drawAxisTicks` + две геометрии),
> `domain/frame-layout.ts` (кэш), `domain/plot-geometry.ts`,
> `application/render/series-factory.ts`, `infrastructure/canvas-size-tracker.ts`.
> Порядок отрисовки байт-в-байт; 288 тестов зелёные.

`TimeseriesChartState` несёт 4 ответственности: анимация вьюпорта, кэш layout,
2D-отрисовка осей/сетки (~190 строк канвас-пейнтинга), оркестрация GPU-пайплайнов.

- **План**: извлечь axis/grid-пейнтер в отдельный модуль по образцу
  `binance-view/domain/axis-draw/`; layout-кэш — отдельный класс. Внутри
  `renderCanvasAxes` циклы X- и Y-тиков почти дублируются — свернуть.

### [x] 22. `features/binance-view/application/BinanceViewStore.ts` — `attachCanvas` ~175 строк

> Сделано: attachCanvas 175→79; quota-recovery →
> `infrastructure/binance-indexeddb-recovery.ts`; teardown — один хелпер
> `tearDownPipeline` (LIFO сохранён); + `buildPipeline`. НОВОЕ (кандидат в
> отдельный багфикс, LOW): в non-quota-ветке `clearAll`-падения db-коннект не
> закрывается — сохранено как было ради нейтральности рефакторинга.

`:127-303`

- Блок IDB quota-recovery (`:135-167`) — инфраструктурная логика → вынести в
  `infrastructure/` (например `openBinanceDbWithQuotaRecovery`).
- Две почти идентичные teardown-последовательности (`:244-261`, `:265-274`) →
  один приватный хелпер.

### [x] 23. `features/binance-view/presentation/BinanceViewContent.tsx` (322 строки)

> Сделано: 322→241; `hooks/useHoverAnchor.ts` (63) и
> `hooks/useHoverHitTestLoop.ts` (96), оба с rAF-cleanup на размонтирование.

Вся rAF-машинерия hover-хит-тестов (6 `useFunction`-колбэков, 7 ref'ов) в теле
компонента.

- **План**: извлечь `useHoverAnchor` / `useHoverHitTestLoop` в
  `presentation/hooks/` — компонент сведётся к разметке и wiring.

### [x] 24. `features/pendulum/presentation/components/DrawNeuralNetwork.tsx` (405 строк)

> Сделано: 405→114; `domain/neural-network/layout.ts` (чистый layout + hit-test,
> +14 unit-тестов), `domain/renderers/renderNeuralNetwork.ts` (painter рядом с
> существующими render*); цвета — константы, тернарник → `NEURON_FILL_COLORS`
> по `ENeuronLayerType`; origin у painter и hit-test — одна функция.

В одном компоненте: чистая геометрия раскладки сети (`useMemo`, `:68-191`),
canvas-отрисовка (`useEffect`, `:195-343`), hit-test (`:345-367`) и JSX.

- **План**: layout-билдер → domain (чисто, тестируемо); painter → отдельный
  модуль; в компоненте ~100 строк. Захардкоженные hex-цвета (`#d4380d`,
  `#1677ff`) и вложенный тернарник (`:215-220`) → константы-темы + map по
  `ENeuronLayerType`.

### [x] 25. `features/pendulum/presentation/components/GenerationsList.tsx`

> Сделано: честная типизация строк (`players: TGenerationPlayer[]` +
> accessorFn, те же column ids) — ноль `as`-кастов; `scoreTagColor()`;
> именованные булевы + `StartCompetitionPrompt`; мёртвый `useResizeObserver`
> удалён (virtualizer сам наблюдает свой scroll-элемент).

- Трёхуровневая условная JSX-логика (loading × empty × tooltip/list, `:250-288`)
  → именованные булевы / ранние return-блоки.
- Дублирующийся score-тернарник (`:48, :61`) → `scoreTagColor(score)`.
- `useResizeObserver` с неиспользуемым результатом (`:176-179`) → удалить или
  прокомментировать.
- `TGenerationRow = Record<string, unknown> & {...}` + `as`-касты (`:91, :239,
  :246`) → типизировать строки через `players: TPlayerValue[]` + `accessorFn`.

### [x] 26. retro: костыль стабилизации массива через `join(',')`/`split(',')`

> Сделано вместе с п.17: `presentParticipantIds` — `computedStruct`;
> useEffect с 10 зависимостями заменён на `reaction` в конструкторе store
> (dispose через `disposers`).

`features/retro/presentation/Room.tsx:133-142`

- **Проблема**: стабильная ссылка на массив clientId достигается сериализацией в
  строку и обратным сплитом.
- **Исправление**: computed `presentParticipantIds` в `RoomStore` (MobX-computed
  со структурным сравнением даёт стабильность без сериализации); тогда
  `useEffect` с 10 зависимостями (`:149-182`) сводится к `reaction` в store.
  Выполнять вместе с пунктом 17.

### [x] 27. stereometry: `runStereometry` — 300-строчный контроллер-замешание

> Сделано: draw.ts 399→176 (runStereometry ≈90 — только wiring);
> `scene-state-controller.ts` (234, topology+selection+preview+history),
> `scene-hit-tester.ts` (97); тонкий `StereometryStore`
> (canUndo/canRedo/fps/interactionMode, refcounted per puzzle — по прецеденту
> ScorchedGame) вместо самодельных подписок; StereometrySolver 4 useState → один
> store. Рендер/occlusion не тронуты, teardown 1:1. 122 теста зелёные.

`features/stereometry/application/render/draw.ts:49-352`

- **Проблема**: одно замыкание держит мутабельное состояние (topology,
  selection, preview), историю, hit-тесты, ручные Set'ы листенеров и wiring всех
  контроллеров. Единственное место, где application-слой сделан не на MobX, а на
  самодельных подписках (`subscribeHistory`/`subscribeFps` + `useState`).
- **План (минимум)**: разбить на hit-тест-сервис, связку history+topology и
  wiring контроллеров. Опционально — тонкий `StereometryStore` для UI-состояния
  (canUndo/canRedo/fps/interactionMode), чтобы фича не выбивалась из конвенций.
  Отказ от MobX для кадрового состояния оправдан — не трогать.
  Рендер/occlusion не трогать вовсе.

### [ ] 28. `features/stereometry/domain/representation.ts` (1071 строка) — не срочно

Файл длинный, но когезивный и полностью покрыт тестами (~1600 строк тестов).
Если разбивать — по естественным швам: `build-markers.ts`, `process-line.ts`
(+ `clipLineToConvexPolygon`/интервальная математика), `build-edge-segments.ts`.
Низкий приоритет — можно не делать.

---

## P2 — Дублирование между фичами (вынести в `libs/`)

Прямое требование CLAUDE.md «No code duplication across apps». Ядро повторено,
различия — в доменных надстройках.

### [x] 29. WebAudio-движок: scorched ↔ tanks

Параллельные пары с общим скелетом (~112 строк diff из ~150):
`infrastructure/audio/sound-engine.ts` (unlock через user gesture — Firefox
требует resume из жеста, master gain, patch-плеер), `audio/jingles.ts`
(нот-секвенсер), паттерн muted-storage. Различия только в надстройках
(wind-ambience vs engine-hum, наборы рецептов).

- **План**: извлечь патч-плеер + jingle-секвенсер + gesture-unlock в
  `libs/` (новый `@frozik/audio` или раздел в `@frozik/utils`), в фичах оставить
  только рецепты/пресеты.
- **Статус**: сделано в `libs/utils/src/audio/` (там уже жили synth/noteFrequency
  — новый пакет разрезал бы связное ядро): `soundEngine.ts` (138,
  `createSoundEngine<TAmbience>` c gesture-unlock/master gain/mute ramp),
  `jingle.ts` (52, `toJingleSoundPatch`) + тесты секвенсера. Фичи ужаты:
  tanks sound-engine 142→66, jingles 90→50; scorched 166→85 и 110→68 — в фичах
  остались только рецепты и hum/ambience. Семантика 1:1 (ids, гейны, порядок
  нот, порядок dispose).

### [x] 30. Рендер-инфраструктура: scorched ↔ tanks

> Сделано: `libs/utils/src/webgpu/letterboxTransform.ts` (общая
> letterbox-математика, различие фич — одна опция `snapToWholePixels`, 4 теста)
> и `updateOnlyLayer.ts` (`createUpdateOnlyLayer` — общий скаффолд; классы
> uniform-слоёв НЕ были идентичны: у scorched screen-shake — остались
> фабриками в фичах). `render-constants.ts` НЕ дедуплицированы — совпадают
> только именем файла, содержимое не пересекается (терраформинг/шейк vs
> NES-тайминги). 1464 теста зелёные.

`view-transform.ts` (letterbox-раскладка поля), `layers/uniform-update-layer.ts`,
`render-constants.ts`.

- **План**: общую математику/скелет — в `@frozik/utils/webgpu` (рядом с
  RenderLayerManager); проверить, что `render-constants` действительно
  дублируются, а не просто совпадают по имени.

### [x] 31. Chart-engine: binance-view ↔ timeseries

> Сделано в узком честном объёме: `libs/utils/src/webgpu/lruSlotPool.ts`
> (LruSlotPool + doubleSlotCapacity, 9 тестов) — три копии политики
> free-list/LRU/рост сведены к одной; slot-allocator 215→165,
> block-texture-slot-manager 298→231, texture-row-manager 239→179;
> `KeyedSlotPool` остался в binance (второго потребителя нет). НЕ извлечены
> обоснованно: генерация тиков (календарные Temporal-тики vs таблица кандидатов
> + бин-лестница), text-measure кэш (существует только в timeseries; подключить
> его к binance — отдельная перф-возможность), viewport-контроллеры (чистые
> функции vs stateful RAF с follow-pin), spatial-индексы (разные ключи поверх
> RBush). 924 теста зелёные.

Обе фичи имеют собственные: spatial index блоков, slot/texture-аллокаторы
(`slot-allocator` vs `block-texture-slot-manager`/`texture-row-manager`),
viewport-контроллеры с lerp/инерцией, генерацию осевых тиков, text-measure кэш.
Шейдеры различаются по содержанию — это ок.

- **План**: инфраструктурный слой «блочная текстура + LRU + вьюпорт» →
  `@frozik/chart-engine` (или раздел в `@frozik/utils`). Самый крупный источник
  будущего расхождения. Перед извлечением сверить семантику: если
  viewport-контроллеры различаются существенно (1D vs 2D, follow-режимы) —
  извлекать только реально общее, не создавать бесполезную абстракцию.

### [x] 32. Камеры: stereometry ↔ sun

> Сделано: `libs/utils/src/webgpu/pointerGestureTracker.ts` (161 строка;
> capture c try/catch, blur-сброс, pinch через computePinchScale c защитой от
> вырожденного кадра, wheel, полный destroy; 18 тестов). Контроллеры: stereometry
> 332→254 (только turntable-поведение), sun 226→145 (только trackball) +
> переименование в `SunCameraController` — коллизия имён устранена. Поведение
> байт-в-байт, включая асимметрии (pointercancel без gesture-end). 746 тестов.

Два разных интерфейса с одним именем `OrbitalCameraController`, ~100 строк
почти идентичной pointer-механики (Map активных пойнтеров, pinch, wheel,
подписки).

- **План**: общий pointer-gesture-трекер в `@frozik/utils/webgpu`
  (capture, blur-сброс, `computePinchScale` внутри); поведенческая разница
  (trackball vs turntable) остаётся в фичах. Закрывает и пункт 13 системно;
  устранить коллизию имён интерфейсов.

### [x] 33. Одинаковая гонка init/teardown: `runSun`/`runCharter`/`runStereometry`

> Сделано: `libs/utils/src/webgpu/runGpuApp.ts`
> (`runGpuApp<TSession>({ init, onReady?, initErrorMessage })` — сессия-объект,
> закрытая гонка cleanup-до-резолва, 3 теста); все три фичи переведены, порядок
> teardown сохранён. `ensureDepthTexture` НЕ дедуплицирован осознанно: в
> scene-layer это одна из четырёх сцепленных depth/ID-текстур, вынос трогал бы
> hard-won render-путь ради ~20 строк — извлекать только при третьем
> потребителе, с визуальной проверкой.

`sun-draw.ts:9-34`, `chart-draw.ts:23-45` (+ stereometry) — одинаковый паттерн
`destroyed`/`gpuCleanup` вокруг асинхронного init.

- **План**: хелпер `runGpuApp(canvas, init): VoidFunction` в
  `@frozik/utils/webgpu`. Туда же — рассмотреть продублированные
  `ensureDepthTexture` + `DEPTH_FORMAT` + `MIN_DIMENSION` из
  sun-layer/scene-layer (рядом с `msaaTextureManager`); scene-layer трогать
  только если извлечение не меняет поведение (hard-won).

### [x] 34. Правило слоёв: снять противоречие CLAUDE.md ↔ практика

> Сделано с коррекцией аудита: `player-colors` ОСТАЁТСЯ в infrastructure — его
> читают 4 GPU-модуля (tank/projectile/overlay-layer, tank-blueprint), перенос
> инвертировал бы зависимость; `view-transform` тоже — он часть input-пайплайна
> (useDragAim hit-тесты) и world→clip uniform'ов. CLAUDE.md дополнен
> исключением: shell-компонент вправе конструировать infrastructure-объекты и
> отдавать их в application; чисто презентационные хелперы — только в
> presentation/. Асимметрия input-источников tanks осознанна (touch обслуживает
> HUD и переживает ремаунты рендерера) — не выравнивалась.

CLAUDE.md: «presentation … never imports from infrastructure directly», но в
scorched/tanks это нарушено в 11 файлах — осознанно (shell-компонент владеет
рендерером и input-источниками; задокументировано в `ScorchedGame.tsx:40-43`):

- `scorched/presentation/components/ScorchedGame.tsx:13-17` (`AimGhost`,
  `KeyAimSource`, `PointerAimSource`, `mergeScorchedInputs`,
  `pickRandomSkyPreset`);
- `scorched/presentation/hooks/useDragAim.ts:7-11`, `useFieldTransform.ts:6-7`;
- `player-colors` — из 6 компонентов;
- `tanks/presentation/components/TanksGame.tsx:16-17`.

- **План**:
  1. `player-colors` (и `view-transform`, если он чисто презентационный) —
     перенести из `infrastructure/` в `presentation/`;
  2. для input-источников/рендерера — зафиксировать в CLAUDE.md уточнение:
     «shell-компонент вправе конструировать infrastructure-объекты и передавать
     их в application». Сейчас внутри tanks два input-источника живут по разные
     стороны границы (`TouchControlSource` — в store, `KeyStateSource` — в
     компоненте) — оценить, нужно ли приводить к одному стилю.

### [ ] 35. retro ↔ conf: выровнять диалекты

- [x] Единый copy-link UX с фидбеком (см. пункт 11) — `ShareLinkDialog`
  показывает результат.
- [x] `DisposableBag` в `@frozik/utils` (`disposable/DisposableBag.ts`, LIFO +
  detach-before-invoke + reusable, 6 тестов): применён в `ConfRoomStore` — 10
  unsubscribe-полей → 2 bag'а (session/peer), дубль teardown ушёл (−176/+141);
  бонусом закрыты утечка взведённого peer-таймера в dispose() и сброс
  qualityTier. В `AuthSession` осознанно НЕ применён (там единственный
  refreshTimer со слотовой семантикой — bag не упрощает). Retro `disposers`
  оставлен как есть (свежий рефакторинг).
- [ ] `conf-room-index-repo.ts` / `room-index-repo.ts` — структурно идентичные
  IndexedDB-репозитории; можно вынести generic «recent-rooms repo», но схемы
  различаются — низкий приоритет.

### [x] 36. Глобальный WebSocket-шим — легализовать или устранить

> Выполнен вариант (в): шим зафиксирован как осознанный архитектурный долг в
> CLAUDE.md («Known Architectural Debt») с запретом новых зависимостей от шима
> и указанием пути миграции (подход conf). Варианты (а)/(б) требуют живой
> проверки WebRTC в нескольких браузерах — не для автономной сессии; при их
> реализации заодно устранить in-place мутацию iceServers в yjs-providers.ts.

`shared/communication/YWebrtcSignalingConnAdapter.ts:312-342`

- **Проблема**: подмена `globalThis.WebSocket` ради y-webrtc. Сделано аккуратно
  (сохранение статических констант, идемпотентность, late-reconnect), но это
  process-wide monkey-patch с несъёмной установкой, затрагивающий все будущие
  WebSocket приложения.
- **Варианты**: (а) pnpm patch y-webrtc с инъекцией фабрики соединений;
  (б) собственный тонкий провайдер поверх `y-protocols` — conf уже доказал, что
  прямой `signalPublish`-клиент работает без шима; (в) минимум — зафиксировать
  как осознанный архитектурный долг в CLAUDE.md/README.
- **Связано**: `retro/infrastructure/yjs-providers.ts:105-108` — мутация
  `peerConfig.iceServers` in place (задокументированный компромисс, зависит от
  недокументированного поведения y-webrtc) — устранить при том же патче.
- **Примечание**: варианты (а)/(б) требуют ручной проверки WebRTC в двух
  браузерах — не делать без живой верификации.

---

## P3 — Данные и типизация

### [x] 37. Уровни tanks: ~24 800 строк константной «карты» — перекодировать

> Сделано: `stage-maps.ts` (35 карт × 31 строка, легенда `.bS~ifE` — та же,
> что в registry.test.ts) + `stage-format.ts` (парсер с assert-валидацией, 10
> тестов). Эквивалентность доказана временным тестом при обеих версиях данных в
> дереве: поячеечное `toBe`-сравнение всех 23 660 ячеек + очереди врагов, затем
> старые файлы удалены. Директория levels/: 25 162 → 1 554 строки (−94%).
> cross-source-check и registry-тесты зелёные без правок.

`features/tanks/domain/levels/stage-01.ts … stage-35.ts` (35 × 710 строк)

- **Проблема**: карта 26×26 записана по одной ячейке-константе на строку.
  Нечитаемо как карта, раздувает репозиторий, 35 импортов-перечислений.
- **План**: компактные строковые ряды (один символ на ячейку, 26 строк на
  уровень: `'..BB..S..'`) + крошечный парсер в `registry.ts`. Уровень станет
  ~30 строк вместо 710, карту видно глазами. `cross-source-check.test.ts`
  защищает конвертацию (плюс сгенерировать снапшот-сравнение старое↔новое перед
  удалением старых файлов).

### [x] 38. stereometry: строковые модификаторы стилей → union-тип

> Сделано: `StyleModifier` (8 значений) в render-types.ts, все точки создания
> типизированы (опечатка теперь TS2820 c «Did you mean»); `resolveStyle`
> осознанно остался генеричным (`readonly string[]` — ключи каскада, тест
> «unknown modifiers pass through» не ослаблен). Найдено и задокументировано:
> `'edge'` не имеет стилевого ключа, но load-bearing для segment-merge и
> дедупликации (выигрывает сегмент с бОльшим числом модификаторов) — не мёртвый.

`features/stereometry/domain/render-types.ts`, `representation.ts:256-282, 342-374`, `constants.ts`

- **Проблема**: `modifiers: readonly string[]` со значениями `'inner' |
  'selected' | 'segment' | 'edge' | 'input' | 'preview' | 'solution' |
  'hidden'`, размазанными литералами. Опечатка молча даёт дефолтный стиль.
- **Исправление**: `type StyleModifier = 'inner' | …`; типизировать `modifiers`;
  ключи style-карты оставить строками.

### [ ] 39. stereometry: ручной GPU-layout → `makeStructuredView` (перспектива)

`scene-layer.ts:105-128` vs `sun-layer.ts:41-42` / `uniform-manager.ts:21-22`

- sun/graphics используют `webgpu-utils` (`makeShaderDataDefinitions` /
  `makeStructuredView`) — layout выводится из WGSL и не может разъехаться;
  scene-layer держит ручную таблицу float-офсетов.
- **Только с визуальной проверкой на устройстве** (occlusion-пайплайн hard-won).
  Без готовности проверять пиксели — не делать; ручной вариант задокументирован
  хорошо.

### [x] 40. Типизация вместо кастов (остатки)

- [x] `welcome/fx/effects.ts` — state-баги эффектов (закрыто пунктом 20);
- [x] `pendulum/GenerationsList.tsx` — строки таблицы (закрыто пунктом 25);
- [x] `sudoku/FieldControls.tsx` — event/dataset (закрыто пунктом 5);
- [x] `shared/communication/AuthSession.ts:318-334` — ручной декодер →
  `jwtDecode<Partial<IExpiringJwtPayload>>` с runtime-проверкой exp/iat
  (пакет уже был в root — используется OIDC-провайдерами); обработка ошибок
  сохранена.

---

## P4 — Документация и гигиена

### [x] 41. CLAUDE.md устарел

> Сделано: структура приведена к фактическому дереву (все 13 фич в порядке
> routeMetadata, bootstrap/hooks/communication/icons, убран webgpu-charts);
> CommonStore удалён из описания, strict mode → StoreBootstrap,
> задокументирован useRefcountedFeatureStore; Libraries дополнены
> audio/webgpu/disposable + `@frozik/communication-protocol`; Tech Stack
> сверен с package.json (Dockview удалён, добавлены MediaPipe/Yjs/socket.io/
> dnd-kit и др.). README: исправлены устаревшие факты (250k инстансов sun,
> 4 инструмента binance, реальные шаблоны retro, анонимный вход conf и т.д.).
> Попутно вычищены: неиспользуемая секция `templates` из переводов retro
> (имена шаблонов живут в domain/templates.ts) и разделительный комментарий в
> timeseries/domain/constants.ts.

- `CommonStore.ts` больше не существует (strict mode переехал в
  `StoreBootstrap.tsx`), раздел Root store pattern описывает старую структуру.
- В описании структуры нет фич: tanks, scorched, retro, conf, binance-view,
  timeseries, stereometry, graphics; упомянут несуществующий `webgpu-charts`.
- Зафиксировать уточнение правила слоёв (пункт 34) и судьбу WebSocket-шима
  (пункт 36).
- Для portfolio-репозитория README.md — публичная витрина: отразить новые фичи
  (требование самого CLAUDE.md).

### [x] 42. `main.tsx` — три несвязанные задачи

> Сделано: `app/bootstrap/cloudflareBeacon.ts` + `app/bootstrap/serviceWorkerUpdate.ts`
> (перенос 1:1, innerHTML-баннер изолирован с пояснением); main.tsx 97→32.

Cloudflare beacon, SW-update-баннер (innerHTML-SVG строкой), React bootstrap —
в одном файле.

- **План**: `app/bootstrap/cloudflareBeacon.ts`,
  `app/bootstrap/serviceWorkerUpdate.ts`; `main.tsx` — только wiring.
  innerHTML-SVG для пре-React баннера приемлем (React ещё не смонтирован) —
  оставить, но изолировать в модуле.

### [x] 43. pendulum: SCSS-модули против Tailwind-конвенции

> Сделано: оба модуля мигрированы и удалены (общие правила →
> `presentation/constants.ts` по прецеденту tanks; одноразовые — inline
> утилитами). Две мёртвые правила осознанно не перенесены: border с
> несуществующей `--text-color` (не рисовался) и `descriptionClose` с опечаткой
> ключа (стили не применялись) — перенос менял бы фактический вид.

`features/pendulum/presentation/components/*.module.scss` — два модуля.
Новые стили писать только в Tailwind; существующие мигрировать при случае
(не переименовывать SCSS→CSS — осознанное решение проекта).

---

## Порядок реализации

1. **P0 (пункты 1-16)** — баги и мелочи: низкий риск, высокая ценность.
2. **P1 (17-27)** — разбиение тысячников: наибольший выигрыш читаемости.
   Порядок: 17 (RoomStore, вместе с 26) → 18 (round.ts) → 19 (ScorchedStore) →
   20 (effects.ts) → 21-25 → 27.
3. **P2 (29-36)** — дедупликация в `libs/`: 32 (камеры, закрывает баг 13) →
   29 (аудио) → 33 (runGpuApp) → 30 → 31 (chart-engine, самый крупный) →
   34-35 → 36 (шим — отдельным решением).
4. **P3 (37-40)** — уровни tanks, типизация.
5. **P4 (41-43)** — документация.

После каждого блока: `pnpm check-all`. Пункты 7, 27, 39 затрагивают stereometry —
рендер/occlusion не менять без визуальной проверки на устройстве.

---

## Итог сессии 2026-08-29 (ночная автономная реализация)

**Выполнено 40 из 43 пунктов.** Финальный `pnpm check-all` зелёный:
155 файлов тестов / 2272 теста (было ~2000), lint, format, types, madge,
sort, server-deps-isolation — всё чисто. Коммитов не делалось.

**Осознанно отложено (3):**
- **28** — разбиение `representation.ts` (1071): когезивен, покрыт тестами,
  сам аудит пометил «можно не делать».
- **39** — перевод scene-layer на `makeStructuredView`: только с визуальной
  проверкой пикселей на устройстве (hard-won occlusion).
- **35 (часть)** — generic «recent-rooms repo» для retro/conf: схемы IndexedDB
  различаются, выигрыш мал (LOW).

**Требует визуальной проверки в браузере (рефакторинги поведенчески
нейтральны по тестам, но пиксели не проверялись):**
- sudoku: контролы div→button (пункт 5);
- pendulum: миграция SCSS→Tailwind (пункт 43), DrawNeuralNetwork (24);
- фоновые анимации: GameOfLifeBackground на useAmbientCanvas (14),
  welcome fx-эффекты (20);
- timeseries/graphics/sun/stereometry: отрисовка после разбиений (21, 27, 33).

**Найдено и исправлено после сессии (по репорту пользователя):**
- `shared/hooks/useAmbientCanvas.ts` — при повторном запуске эффекта на уже
  правильно отресайзенном канвасе (StrictMode-ремаунт в dev) ранний выход
  «no-op resize» в `applySize()` оставлял локальные `dpr`/`cssWidth`/`cssHeight`
  равными 1/0/0 и не вызывал `onResize` — hero-ордербук рисовал ленту цен с
  `dpr=1` (вдвое меньше) до первого реального ресайза. Фикс: `applySize(force)`
  — первый вызов синхронизирует метрики и зовёт onResize всегда, но не трогает
  backing store, если размер совпал (присваивание очищает канвас); ранний выход
  остался только для ResizeObserver. Дополнительно закрыта смежная дыра:
  ResizeObserver не реагирует на смену devicePixelRatio без изменения CSS-размера
  (перенос окна на другой монитор, зум) — добавлена matchMedia-подписка на
  `(resolution: N dppx)` с перевзведением после каждой смены. Баг касался всех
  7 потребителей хука (фон, hero, project-fx, game-of-life, фоны retro/conf/
  controls). Проверено визуально в Chrome: hero, карточки проектов, меню.

**Новые кандидаты на будущее (LOW, зафиксированы по ходу):**
- binance: утечка db-коннекта в non-quota ветке падения `clearAll`
  (см. пункт 22);
- binance: подключить text-measure кэш к осям (перф, см. пункт 31);
- welcome: короткие имена `i/j/v/m1/p1` внутри `draw-rotate.ts`/`draw-peers.ts`
  (порт референса, см. пункт 20);
- retro: неиспользуемые after-cleanup ключи переводов проверить по остальным
  фичам тем же приёмом (grep по `t.<section>`).
