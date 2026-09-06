# BookNest — Статистика — вкладка «Огляд»

> Накопичувальна специфікація. У файл додаються лише погоджені рішення.

## Canonical Overview response metadata

Every successful `/api/statistics/overview` response, including empty/partial periods, includes top-level:

- `meta.generatedAt` — backend ISO-8601 response-generation instant for diagnostics/debugging; not a selected-period timestamp, dataset version or transaction snapshot guarantee;
- `meta.timezone` — resolved canonical `UserProfileSettings.timezone` used for user-local `today`, relative period endpoints and current-streak context; historical persisted reading `@db.Date` values are not timezone-rebucketed;
- `meta.weekStartDay` — resolved canonical `UserProfileSettings.weekStartDay` actually used for week buckets and calendar column ordering.

`meta.weekStartDay` is the single response-level source; do not duplicate a separately-populated `calendar.weekStartDay`. `period` and `comparison` remain separate top-level sections. V1 does not invent `dataVersion`/`snapshotVersion` without a real BookNest versioning/cache contract.

## Canonical historical metadata semantics

Completed reading cycles use immutable **completion-time analytics metadata snapshots** (`shared/19-historical-metadata-snapshots.md`) for historical author/genre/publisher/language/series membership and book-length facts. Later edits to the current Book or its relations do not rewrite old periods. Current names/covers/routes may enrich presentation when identity still exists, but must not redefine historical membership. Legacy backfilled cycles capture current known metadata once with explicit provenance and then freeze it.

## 1. Глобальний вибір періоду

- Один глобальний period для всіх вкладок статистики.
- Default: поточний календарний рік від 1 січня до сьогодні.
- Presets: конкретний рік, останні 12 місяців, увесь час, власний період.
- Роки генеруються за фактично наявними даними.
- Власний період задається `from` / `to` у popover.
- Порівняння — опціонально з еквівалентним попереднім періодом.
- Для поточного року порівнюється однакова частина року, а не весь попередній рік.
- Для custom range використовується попередній інтервал такої самої тривалості.
- Для `Увесь час` comparison недоступний.
- Period зберігається в URL query params.
- Backend виконує всі period/comparison calculations.
- Period metrics і current snapshot не змішуються.
- Для періоду без даних показується цілісний empty state замість набору нульових карток.

### Global exact drill-down rule

Для всіх interaction нижче діє одна семантика: **click/chevron = exact subset, з якого порахована statistic**. Related-but-not-exact navigation (`Відкрити автора`, `Відкрити видавництво`, `Відкрити серію`, ширший список бібліотеки) є окремою explicit context action. Якщо existing destination не підтримує потрібні period/entity/filter params, не використовувати approximate/fuzzy navigation: залишити exact Statistics detail або спочатку розширити destination contract.

## 2. Hero — підсумок періоду

- Hero має давати емоційний snapshot, а не дублювати KPI.
- Динамічний title:
  - `2026 у книгах`;
  - `Останні 12 місяців`;
  - custom range;
  - `Ваше читання за весь час`.
- Підзаголовок: короткий опис підсумку періоду.
- Один головний deterministic insight, який backend обирає за релевантністю.
- Hero не містить кількість книг, сторінок, середню оцінку, progress goal чи CTA.
- Праворуч: до 4 останніх завершених **reading cycles** періоду, deterministic order `cycle.finishedAt DESC → readingCycleId ASC`; якщо та сама книга завершена кілька разів, exact historical identity не зливається. Якщо Hero дедуплікує covers лише як presentation choice, він проходить already-sorted sequence і лишає першу occurrence кожного `bookId`, без зміни aggregate semantics.
- Cover hover: title, author, rating; click → book details.
- Fallback: завершені книги → останні додані → декоративна композиція без fake covers.
- Hero підкоряється global period.
- Comparison insight використовується лише коли comparison увімкнений.

## 3. Основні статистичні картки

Усі 4 картки неклікабельні, компактні, однакового типу.

1. `BookCheck` — **Прочитано**
   - primary: `37 читань` (`completedReads`)
   - supporting context: `35 унікальних книг` (`uniqueBooksCompleted`); це не окрема п'ята KPI-картка
   - comparison на картці стосується primary `completedReads`: `↑ 8 читань · +28% проти 2025`
   - `completedReads` рахується за canonical finished reading cycles (`shared/17-reading-cycle-history.md`) та їх stored date-only `finishedAt`; reread, завершений повторно, є окремим completed read
   - `uniqueBooksCompleted = COUNT(DISTINCT bookId)` серед цих completed reads; це не `firstBookCompletion`.

2. `BookOpen` — **Прочитано сторінок**
   - `12 840`
   - comparison має пріоритет;
   - без comparison: `≈56 сторінок в активний день`.
   - враховуються лише фактичні `BookReadingProgressEvent.pagesRead` за canonical stored date-only `event.date`; `createdAt` не підміняє reading day і stored `date` не re-bucket-иться через timezone.

3. `Star` — **Середня оцінка**
   - `8,6 / 10`
   - `28 із 37 читань оцінено`. Coverage denominator = completed reads, not distinct books.
   - coverage завжди важливіший за comparison і використовує canonical `{ eligibleCount, knownCount, percent }`.

4. `CalendarCheck` — **Активні дні**
   - `96 днів`
   - `43% днів періоду`.

Правила:

- не реконструювати історичні pages із `pagesCount`, якщо немає progress events;
- `0` і `unknown` — різні стани; public contract використовує `available | partial | unavailable`;
- при недостатніх даних використовувати `availability = unavailable` + typed reason, а UI показує `—` і пояснення.

## 4. Динаміка читання

- Назва: **Динаміка читання**.
- Основний тип: vertical bar chart.
- Toggle: `Читання | Сторінки`, default — `Читання`. `Читання` = canonical `completedReads`, не distinct-book count.
- Reads агрегуються як `completedReads` за canonical finished reading-cycle `finishedAt`, не за mutable current `BookReadingProgress.finishedAt`.
- Historical reading cycles/events remain eligible after a later Book soft delete; `Book.deletedAt` is not a retroactive history filter. Current-library snapshots follow the separate active-book rule in `shared/18-soft-deleted-book-eligibility.md`.
- Pages — лише за `BookReadingProgressEvent.pagesRead`.
- Tooltip завжди може показувати обидва показники.
- Click bucket → **exact** detail popover з covers; primary drill-down містить саме completed reading cycles canonical bucket у global period. CTA `Переглянути книги` дозволений лише якщо destination filters відтворюють цей subset точно; інакше ширша навігація є окремою explicit context action.
- Comparison: current bars + previous-period line.
- Granularity:
  - ≤31 дня — day;
  - 32–180 — week;
  - > 180 — month;
  - All time — year.
- Weekly buckets MUST align to existing `UserProfileSettings.weekStartDay` (`monday | sunday`, current default `monday`), not hardcoded ISO weeks; edge buckets are clipped to selected period.
- Поточний рік показує лише місяці до сьогодні.
- Нульові минулі bucket зберігаються як реальні нулі.
- Відсутні progress events не підміняються pagesCount.
- Backend повертає `peakReadingPeriod`.
- Summary може показувати найактивніший bucket.
- Mobile: horizontal scroll/tap interactions.

## 5. Читацький календар

### Режим `Активність`

- Heatmap.
- Клітинка = календарний день.
- Active day: `sum(pagesRead) > 0`.
- Intensity — відносна до активності користувача у вибраному period.
- Legend: менше → більше.
- Hover/tap дня: pages + books count + book breakdown.
- Click → exact shared day-details popover/bottom sheet для canonical activity subset цього дня.
- KPI всередині використовують explicit Calendar `metricRange`:
  - активні дні;
  - найдовша серія;
  - поточна серія — тільки для period, whose effective end is user-local today.
- Для закритого historical period `currentStreak` = `unavailable/PERIOD_NOT_CURRENT`; UI не показує `0 днів`, а приховує/reflow-ить цей KPI.
- Для current period current streak не втрачається протягом поточного дня, якщо останнє читання було вчора; counting clip-иться до `metricRange.from`, а continuation до period повертається як `continuesBeforeRange`.
- Canonical date semantics — `shared/16-reading-date-semantics.md`: stored progress/event `@db.Date` values are calendar-date labels and do not timezone-shift. Existing `UserProfileSettings.timezone` resolves user-local `today`/`yesterday` and relative period endpoints. Books/Reading implicit default `today` must use that timezone instead of UTC; не створювати Statistics-specific timezone setting.
- Calendar weekday ordering і всі week-aligned aggregates використовують existing `UserProfileSettings.weekStartDay` (`monday | sunday`); не hardcode-ити Monday-first/ISO-week semantics і не створювати Statistics-specific week-start setting.
- Додатковий insight: найактивніший день тижня.
- Не робити висновків про час доби.
- Calendar range semantics — `shared/20-calendar-streak-period-semantics.md`: response окремо повертає `metricRange` для KPI та `displayRange` для day cells.
- All time: KPI (`activeDays`, percentage, longest streak, weekday) використовують весь reliably tracked activity range від першого progress event до today, а heatmap/Books day payload показує лише backend-resolved останні 12 місяців із явним caption. Не підміняти lifetime KPI last-12-month значеннями.
- Без progress events — чесний empty state.

### Режим `Книги`

Segmented control: **Активність | Книги**. Default — `Активність`.

Books mode MUST be renderable from the single Overview response. Each calendar day exposes compact `booksPreview` (max 3, deterministic `pagesRead DESC` → `bookId ASC`) plus `remainingBooksCount`; full day details are requested only after explicit interaction. Do not issue one `/statistics/reading-days/:date` request per visible day.

Desktop:

- month calendar;
- порядок weekday columns визначається canonical `meta.weekStartDay`: Monday-first для `monday`, Sunday-first для `sunday`;
- день містить cover книги/книг, які реально читали цього дня;
- максимум 2 covers + `+N`;
- primary cover = книга з найбільшою кількістю прочитаних сторінок цього дня;
- показувати total pages дня;
- month navigation обмежена global period.

Mobile:

- vertical reading diary/timeline замість мікроскопічного calendar grid.

Спільне:

- day-details перевикористовується для обох режимів;
- KPI календаря при перемиканні режиму не змінюються;
- джерело — ті самі progress events;
- жодної реконструкції вигаданої історії.

## 6. Інсайти

- Dynamic backend-driven block, а не фіксовані KPI.
- Backend Insight Engine uses **one shared selection pipeline for both Hero and regular Insights**:
  - candidates;
  - eligibility;
  - significance;
  - minimum sample;
  - deduplication/diversification;
  - ranking;
  - one ranked candidate pool.
- `hero.featuredInsight` is selected from that ranked pool (highest-ranked hero-eligible candidate; in V1 this may simply be the first ranked candidate when all supported codes are hero-safe).
- `insights.items` are the next candidates from the same ranked pool, excluding the featured semantic candidate, up to 4.
- Do not run a second eligibility/significance/diversification/ranking pipeline for Hero. Frontend does not rerank or dedupe.
- До 4 найрелевантніших insights на desktop; можна менше.
- Не використовувати LLM у V1; deterministic templates.
- Категорії:
  - Reading;
  - Activity;
  - Genres;
  - Authors;
  - Series;
  - Library;
  - Ratings;
  - Discovery;
  - Collection.
- Positive, neutral і negative trends без оцінювальної мови.
- Не використовувати judgement colors.
- Insight може бути informational або actionable.
- Backend **не повертає готовий локалізований текст** insight. Canonical payload використовує stable typed `code` + code-specific typed `params`, а також semantic metadata (`category`/`tone`/icon semantics) і optional typed `action`.
- `code` є стабільним semantic identifier, а не українським/англійським реченням і не frontend URL.
- `params` MUST бути типізовані через discriminated union за `code`; не використовувати `Record<string, unknown>` як public contract.
- Frontend мапить `code` на `next-intl` message і підставляє `params`; backend володіє eligibility/significance/ranking і числами, frontend — лише мовною presentation.
- Hero featured insight використовує той самий typed insight contract **і той самий backend-ranked candidate pool**, що й regular Insights; окремий Hero selector/engine не створювати. Featured candidate не дублюється в `insights.items`; окремий backend-localized `hero.text` для insight не створювати.
- Comparison insights лише коли comparison увімкнений.
- All time → lifetime records.
- Якщо немає достатньо достовірних insights, блок може містити менше 4 або не показуватись.

## 7. Найактивніший місяць

- Окремий standalone widget **не створювати**.
- Backend усе одно рахує `peakReadingPeriod`.
- Використовувати:
  - у summary блоку `Динаміка читання`;
  - як candidate для Insight Engine, якщо відхилення значуще.
- Термін `найпродуктивніший` не використовувати; нейтральне `найактивніший`.

## 8–9. Оцінки

Об'єднана велика секція **Оцінки**: rating analytics + `Найвище оцінені`. Favorite-state analytics не входить у guaranteed V1; див. `shared/21-ratings-vs-favorites-semantics.md`.

Ліва частина:

- середня оцінка у canonical BookNest scale `0.5–10.0`, step `0.5`, presentation `x.x / 10`;
- rating coverage;
- distribution за canonical rating values (`10.0`, `9.5`, `9.0`, ... `0.5`) або lossless UI grouping, що не змінює семантику шкали;
- частка rated completed reads із `rating >= 8.0`.
- Statistics не конвертує rating у `1–5★` ні на backend, ні на frontend.
- Враховуються лише completed reading cycles у global period, які мають canonical cycle-level rating.
- DNF не входять в основний Overview rating metric.
- Comparison безпосередньо не перевантажує секцію; значущі зміни можуть стати insight.
- Rating row може відкривати exact popover із тими eligible completed reads, які сформували цей rating bucket; `Переглянути всі` не може скидати global period/rating subset.
- Без ratings: `availability = unavailable`, `value = null`, reason `NO_RATINGS`; UI показує не `0.0`, а empty state.

Права частина — **Найвище оцінені**:

- до 4 книг на desktop;
- mobile — horizontal carousel;
- eligibility: completed in period + rating;
- rating source для historical period — canonical completed-cycle rating; sorting: `rating DESC → cycle.finishedAt DESC → readingCycleId ASC`;
- назва `Найвище оцінені`, а не `Найкращі`;
- cover + title + rating;
- click → book details;
- `Переглянути всі` → exact subset прочитаних за global period, sorted by rating; якщо existing books route не підтримує exact period semantics, CTA не підміняється ширшим списком.
- При 1–2 книгах не дублювати placeholders.
- Hero covers змінені на останні завершені книги, щоб не дублювати Top-rated.

## 10. Жанри

Секція **Жанри**.

Segmented control:

- `Найчастіше читаю` — default;
- `Найвище оцінюю`.

### Найчастіше читаю

- Top-5 horizontal bars.
- Ranking за кількістю завершених читань, snapshot яких містить жанр: `completedReadCount DESC → genreKey ASC`.
- Multi-genre книга може входити до кількох жанрів.
- Не використовувати misleading percentages, що мають сумуватися до 100%.
- Якщо frequency рахується behavioral completed reads, UI показує `13 читань` і `зустрічається у 35% завершених читань`; `книг` використовується лише для distinct-book metric.
- `Переглянути всі жанри`.

### Найвище оцінюю

- average rating жанру;
- minimum sample size: 3 оцінені завершені читання жанру;
- deterministic order: `averageRating DESC → ratedReadCount DESC → genreKey ASC`;
- multi-genre книга може впливати на rating усіх своїх жанрів.

### Додатково

- KPI: `12 жанрів прочитано · 3 нові`.
- `Нові цього періоду` → chips.
- Новий жанр = є завершена книга цього жанру в period і немає раніше завершених книг цього жанру до початку period.
- Для All time блок `Нові` не показується.
- Click genre → exact popover/bottom sheet для completed-read subset, який сформував рядок: count, average rating, covers. CTA `Переглянути всі` має зберегти global period + genre + відповідну eligibility semantics; `Відкрити жанр`/ширший список, якщо потрібен, є окремою context action.
- Comparison напряму не візуалізується; значущі зміни можуть іти в Insight Engine.
- Не використовувати donut/pie, word cloud або псевдотипології.
- Backend рахує на основі книг, завершених у period, а не поточного складу бібліотеки.

## 11. Автори

Секція **Автори**.

Segmented control:

- `Найчастіше читаю` — default;
- `Найвище оцінюю`.

### Найчастіше читаю

- Top-5 авторів за кількістю завершених читань у global period: `completedReadCount DESC → authorId ASC`.
- Horizontal bars.
- Книга з кількома авторами зараховується кожному автору як +1; fractional attribution не використовується.

### Найвище оцінюю

- Ranking за average rating: `averageRating DESC → ratedReadCount DESC → authorId ASC`.
- Minimum sample size: 3 оцінені завершені читання автора.
- Якщо eligible авторів менше 5, показувати лише фактично eligible.

### Нові автори

- Компактний підблок із кількістю та кількома іменами.
- Новий автор = у period є завершена книга автора, а до початку period немає жодної завершеної книги цього автора.
- Не використовувати `author.createdAt` або дату додавання в BookNest.
- Для All time підблок не показується.

### Найчастіше повертаєтесь

- Окремий компактний editorial highlight зі scope `за весь час`.
- Показує автора, до якого користувач систематично повертається.
- Backend ranking: `distinctReadingYears DESC → completedReadCount DESC → latestFinishedAt DESC → authorId ASC`.
- UI показує, наприклад: `4 роки · 11 читань`, бо behavioral ranking використовує completed-read cycles.
- Не називати автора автоматично `улюбленим`.

### Інше

- `Автор року` не створюється окремим widget; це candidate для Insight Engine.
- Click author → exact detail popover/bottom sheet для books-in-period subset, який сформував ranking. Перехід на author profile є окремою context action; CTA до відфільтрованих книг дозволений лише при exact reproduction global period + author eligibility.
- Comparison у ranking напряму не показується; значущі зміни → Insight Engine.
- При недостатньому rating sample показується `availability = unavailable` + typed reason `INSUFFICIENT_SAMPLE`; окремого `insufficient` state немає.
- Mobile: `Читаю | Оцінюю`, вертикальний Top-5, compact discovery та return highlight.

## 12. Серійне читання

Секція **Серійне читання** показує не лише кількість серій, а lifecycle і фактичний прогрес читання серій за global period.

### Lifecycle metrics

- **Розпочато** — first-time completion першої eligible книги серії припадає на period; reread уже прочитаної частини не запускає lifecycle повторно.
- **Продовжено** — до period уже була first-time completion однієї distinct книги серії, а в period first-time completed ще хоча б одну distinct eligible книгу.
- **Завершено** — саме в period користувач уперше досяг стану, коли завершені всі required distinct books завершеної серії.
- **Наздогнано** — для ongoing series: у period користувач уперше досяг стану, коли прочитані всі відомі/доступні distinct books.
- `Завершено` і `Наздогнано` не змішуються.

### Частка серійного читання

- Показувати кількість завершених читань із серій проти standalone reads.
- Наприклад: `16 із 37 читань · 43%`.
- Використовувати compact segmented/progress bar.

### Найактивніша серія

- Editorial highlight із серією, в якій завершено найбільше читань у period.
- Tie-breaker/order: `completedReadCycles DESC → attributablePagesRead DESC → latestFinishedAt DESC → seriesId ASC`.
- Показувати count, pages та 3–4 covers.

### Серійний марафон

- Найдовша послідовність завершених читань однієї серії без завершеного читання іншої серії/standalone між ними.
- Показувати лише при ≥2 completed reads.
- Це окрема метрика від `найактивнішої серії`.

### Найбільший прогрес

- Top-3 серії за кількістю книг серії, завершених у period.
- Показувати before/after або current progress, наприклад `2/8 → 6/8`.
- Ranking не за percentage delta, а за кількістю distinct first-completed у period книг: `distinctProvenFirstCompletionsInPeriod DESC → seriesId ASC`.

### Надійність даних

- Якщо total/order серії ненадійний, дозволено показати completed count, але не вигадувати denominator/progress percentage.
- Series зі status `UNKNOWN` можуть входити в counts/rankings, але не отримують lifecycle classification, яка потребує достовірного status.
- Усі складні classification/progress calculations виконує backend.

### Interaction і scope

- Click series → exact Statistics detail для series metric/subset (completed reads in period, total reading progress, covers). `Відкрити серію` є окремою context action, якщо series page показує ширший lifetime/entity context.
- Comparison не додається до кожного рядка; значущі series trends → Insight Engine.
- All time адаптує lifecycle до lifetime totals/records.
- Якщо в period немає завершених серійних книг — чесний empty state.

## 13. Баланс бібліотеки

Секція **Баланс бібліотеки** відповідає на питання, чи зростає або скорочується непрочитана власна бібліотека.

### Основна модель

- Не використовувати спрощене `created books - finished books`.
- Рахувати canonical TBR flow:
  - **inflow** — книга протягом period реально перейшла у стан власної непрочитаної книги;
  - **outflow** — книга вибула з TBR через завершення читання або іншу валідну lifecycle-причину;
  - **net TBR change** — фактична зміна непрочитаної бібліотеки.
- DNF не вважається `прочитано`, але може бути окремою причиною TBR outflow.
- Усі переходи та класифікації рахує backend.

### Відображення

- Головний показник: `+17 книг — непрочитана бібліотека збільшилася` або `−8 — скоротилася`.
- Додатково показувати inflow та outflow.
- Current snapshot: `87 книг непрочитано зараз`, явно відокремлений від period metrics.
- Current TBR може бути clickable лише якщо бібліотечний destination exact-відтворює canonical current snapshot subset (`owned` + documented unread semantics). Якщо ні — primary click лишається Statistics detail/non-clickable, а ширша бібліотека є explicit context action.
- Без judgement wording/colors.

### Recent trend і прогноз

- Показувати фактичний recent trend TBR, наприклад `+1,4 книги/місяць` за останні 12 місяців.
- Не екстраполювати майбутній TBR у V1.
- Можна оцінювати, на скільки вистачить **поточних** непрочитаних книг за recent sustainable **TBR-reducing first-completion/outflow rate**. Загальний completed-read rate із rereads не використовувати: перечитування не зменшує backlog.
- Для reading-rate forecast використовувати rolling 12 months або доступний recent period при достатній історії.
- Потрібен minimum history/sample; при недостатніх даних прогноз не вигадувати.
- Wording: `Поточних непрочитаних книг вистачить приблизно на ... за вашим останнім темпом`, а не твердження, коли користувач точно прочитає бібліотеку.

### Надійність історії

- Не використовувати `updatedAt` для реконструкції ownership/TBR transitions.
- Перед реалізацією перевірити наявність надійних lifecycle timestamps/events.
- Якщо історичних transition data недостатньо, V1 показує current TBR + доступний forecast, а period balance починає накопичуватися після появи потрібної event history.
- Comparison не перевантажує сам блок; значущі зміни можуть іти в Insight Engine.

## 14. Нові відкриття

- Не дублювати counters `нові автори / жанри / видавництва` з інших секцій.
- Секція **Нові відкриття** показує до 3 конкретних discovery cards:
  - авторське відкриття;
  - жанрове відкриття;
  - видавниче відкриття.
- `Новий` = у global period є завершена книга сутності, а до початку period немає раніше завершеної книги цієї сутності.
- Не використовувати дату створення/додавання сутності в BookNest.
- Картка показує конкретну сутність, контекст першого знайомства, кількість прочитаних після відкриття книг, average rating за достатнього sample, 2–3 covers та total new count категорії.
- Найзначуще відкриття backend обирає deterministic rules **всередині кожного discovery type**, без спільного cross-type score: `completedReadsAfterDiscovery DESC → averageRating DESC NULLS LAST → latestFinishedAt DESC → stable entity key ASC` (`authorId`, `genreKey`, `publisherId`). Якщо рендериться кілька type cards, surface order fixed: `author → genre → publisher`, пропускаючи unavailable type.
- Для головного author discovery потрібен minimum ≥2 завершені книги.
- Не створювати спільний математичний ranking між авторами, жанрами та видавництвами.
- Нову серію сюди не додавати — це вже покриває `Серійне читання`.
- Якщо eligible лише 1–2 discovery types, layout адаптується без placeholders.
- Якщо discoveries немає — секцію приховувати.
- Для `All time` секцію не показувати.
- Comparison усередині секції не показувати; потенційно значущі discovery trends можуть іти в Insight Engine.
- Discovery cards follow exact drill-down semantics: primary card click represents the exact discovery/subset behind the card. Author/publisher profile or broader filtered books navigation is a separate context action unless that destination itself reproduces the exact Statistics subset.
- Mobile: compact horizontal swipe/carousel із максимум 3 cards.

## 15. Мови + conditional Reading Formats capability

### Guaranteed V1: Мови

У guaranteed V1 Overview показує **Мови** для completed reads global period. Це самостійна canonical секція; вона не залежить від availability reading-format analytics.

- Ranking **declared edition languages captured in BookNest at reading completion**. This is the edition-language value stored in the canonical Book field and frozen into the completion snapshot; V1 does not claim separate manual-confirmation provenance for every legacy/defaulted value.
- Аналізувати canonical `Book.language` / edition language, а не оригінальну мову автора/твору. Follow `shared/22-language-reliability-semantics.md`.
- Не визначати мову евристично з title/author/publisher.
- Count + share серед completed reads із valid canonical snapshot language. Coverage означає completeness snapshot, а не explicit-confirmation confidence. Ranking order: `completedReadCount DESC → canonical BookLanguageSchema value ASC`; translated label не є tie-break.
- Compact diversity KPI: `3 мови · 1 нова для вас`.
- Якщо надійно доступні і `editionLanguage`, і `originalLanguage`, optional metric: кількість/частка книг, прочитаних мовою оригіналу.
- `Нова мова` може бути candidate для Insight Engine, а не окремим великим підблоком.
- `Unknown ≠ 0`: percentages рахуються лише серед valid snapshot values. Не вважати `ukrainian` unknown лише тому, що це current default.
- Використовувати shared `available | partial | unavailable` contract; `partial` обов’язково має canonical coverage `{ eligibleCount, knownCount, percent }`, але coverage тут означає **snapshot completeness**. Для normal post-prerequisite cycles воно зазвичай 100%, бо current Book language non-null.
- Missing/invalid legacy snapshot language не показувати як fake `Не вказано` category; воно лише зменшує coverage. Не показувати `Доповнити дані` для finalized historical cycle без explicit historical-correction capability.
- UI helper/caption should be honest: `Мова видання, зафіксована в BookNest на момент завершення читання.`
- Click language → exact popover/bottom sheet for the contributing subset: count, covers, optional average rating. `Переглянути всі` is exact or is replaced/relabelled as an explicit broader context action.
- All time підтримується; semantics `new language` для All time не використовуються.

### Conditional capability: фактично прочитаний формат

Reading-format analytics **не входить у guaranteed V1 scope**.

Поточний `Book.formats[]` може описувати доступні/наявні формати книги або видання, але не доводить, у якому форматі користувач фактично прочитав конкретне завершення. Тому Statistics MUST NOT обирати один елемент із `Book.formats[]`, рахувати multi-value поле як фактичний reading format або показувати format chart лише тому, що це поле заповнене.

Formats можуть з’явитися тільки якщо audit підтвердить canonical reliable source на рівні фактичного читання/видання, наприклад `readingFormat`/edition relation з однозначною semantics.

Якщо така capability з’явиться:

- categories та mapping визначаються canonical domain contract, а не frontend assumptions;
- section використовує той самий period/eligibility/coverage/exact-drill-down contract;
- count + share рахуються лише серед observations із reliable actually-read format;
- format trends можуть бути candidate для Insight Engine;
- metrics `reading speed by format` не додаються в Overview;
- backend може експонувати optional `formats` capability/section, а frontend рендерить її лише коли вона реально supported/available.

Якщо reliable source немає:

- **не створювати migration лише заради V1 Statistics**;
- не резервувати порожню Formats card у desktop/mobile layout;
- не показувати `unavailable` placeholder у звичайному Overview;
- capability вважається deferred/unsupported для V1, а не blocker для сторінки.

Data-quality issues щодо мови можуть іти в `Потребують уваги`, а не в персональні Insights.

## 16. Видавництва

- Один Top-5 horizontal ranking без segmented control.
- Аналізуються completed reads у global period за completion-time publisher snapshot.
- Bar = `completedReadCount`; secondary value = average rating за достатнього coverage.
- Sorting: `completedReadCount DESC → averageRating DESC NULLS LAST → publisherId ASC`; current/display publisher name не є final tie-break.
- `Переглянути всі` при більшій кількості видавництв.
- Rating показувати при достатньому sample; орієнтир — ≥2 rated completed reads.
- Compact metrics: total publishers represented + частка completed reads від Top-3 видавництв.
- Publisher concentration — нейтральна характеристика.
- Використовувати publisher конкретного прочитаного видання, якщо модель це підтримує; інакше визначити canonical publisher source.
- Unknown publisher не входить у ranking; metadata coverage повертається canonical `{ eligibleCount, knownCount, percent }`, а section state стає `partial`, якщо ranking побудований лише на known subset.
- Нові видавництва тут не дублюються — вони покриваються `Новими відкриттями`.
- Comparison deltas у ranking не показуються; значущі shifts → Insight Engine.
- Click publisher → exact Statistics details for the contributing completed-read subset: completed-read count, rated-read count, average rating, covers. `Відкрити видавництво` is a separate context action unless the destination reproduces the same period/subset exactly.
- All time підтримується.
- Mobile: вертикальний Top-5 + bottom sheet.
- Наступні метрики залишати на Overview лише якщо вони дають окрему цінність; детальну аналітику переносити у спеціалізовані вкладки.

## 17. Темп і тривалість читання

Окремий блок на Overview **не створювати**.

- Backend може розраховувати median/average reading duration, duration coverage, fastest completed book, parallel-reading metrics та інші behavioral metrics.
- Для типової тривалості віддавати перевагу median; UI wording: `Зазвичай книгу ви читаєте близько N днів`.
- Duration рахується лише для completed reading cycles із valid cycle `startedAt` + `finishedAt >= startedAt`; missing/invalid dates reduce duration coverage. Mutable current progress dates не замінюють historical cycle dates.
- canonical elapsed duration = **inclusive calendar days** `calendarDayDifference(startedAt, finishedAt) + 1`; same-day completion = 1. It is not actual reading effort/speed. See `shared/33-reading-duration-semantics.md`.
- Без progress events не називати elapsed duration `швидкістю читання`.
- Fastest-read та інші цікаві behavioral records можуть бути candidates для Insight Engine.
- Longest elapsed read, reading gaps та подібні потенційно оманливі/оцінювальні метрики не робити prominent на Overview.
- Parallel reading уже візуально покривається `Читацький календар → Книги`; окремий KPI не потрібний.
- Детальну аналітику перенести в майбутню вкладку **Читання**: duration, reading days per book, pages per active day, fastest/longest reads, parallel reading, gaps, duration × pages/format/genre.

## 18. Ваші рекорди

Окрема editorial/recap секція Overview, принципово відмінна від `Інсайтів`.

- **Інсайти** пояснюють закономірності та зміни; **Рекорди** показують конкретні екстремуми всередині global period.
- Backend `Record Engine` повертає до 4 найцікавіших eligible records.
- Вибір deterministic: priority + eligibility + diversification; не використовувати ML/LLM. Повний fixed record-type priority та tie-break comparators визначені в `shared/23-deterministic-ordering-policy.md`.
- Не займати кілька slots концептуально однаковими records.

### Основні V1 candidates

1. **Найдовша завершена книга** — completion-cycle `pagesCount` snapshot, cover, click → exact cycle/book details; a later edit of current `Book.pagesCount` must not rewrite an old record.
2. **Найнасиченіший день** — максимум фактичних `pagesRead` із progress events; date + books count; click → exact shared day-details for that canonical day.
3. **Найшвидше завершена книга** — лише при достовірних `startedAt + finishedAt`; wording `завершили за N днів`, не `фактичний час читання`.
4. **Найдовший серійний марафон** — уже погоджена послідовність книг однієї серії.

### Fallback candidates

- longest reading streak;
- peak month by books/pages;
- shortest completed book.
- Не використовувати `найвища оцінка = 10/10` як record.
- Purchase/price records не змішувати з reading records Overview.

### Правила

- `Найдовша книга` використовує completion-time cycle `pagesCount` snapshot; activity records — лише фактичні progress events.
- Comparison не показувати.
- All time → lifetime records.
- Desktop: до 4 compact editorial cards.
- Mobile: horizontal swipe/carousel.

## 19. Ціль читання

На Overview показувати одну компактну summary-секцію, а не дублювати повну аналітику Reading Goals.

- Показувати одну **primary active goal**.
- V1 **не додає `isPrimary`** і не робить schema migration лише заради Statistics. Primary selection є deterministic Statistics presentation rule поверх canonical Reading Goals output, а не новою властивістю goal domain.
- Candidate set = лише goals, які canonical Reading Goals layer уже класифікував як `status = active`; Statistics не переобчислює active/completed/expired semantics самостійно.
- Якщо active goal одна — вона primary. Якщо їх кілька, backend вибирає за стабільним порядком: **`deadline ASC` → `createdAt ASC` → `id ASC`**. Тобто спочатку найближчий deadline, при однаковому deadline — раніше створена ціль, потім стабільний `id` tie-break.
- Selection не може залежати від frontend order, default list pagination або incidental DB order. Якщо existing Reading Goals list API не гарантує повний active candidate set, Statistics використовує/додає мінімальний internal application/domain integration point для deterministic selection без нової goal schema semantics.
- Явний `isPrimary` можна вводити лише окремою майбутньою продуктовою зміною, якщо BookNest справді додає user-controlled концепцію «Основна ціль» у Reading Goals загалом; це **поза V1 Statistics scope**.
- Goal зберігає власний scope/dates і не обрізається штучно global statistics period.
- Показувати: current/target, progress, remaining, backend-calculated pace status і forecast/projection при достатній confidence. Актуальний Reading Goals backend уже має canonical `completedCount`, `remainingCount`, `progressPercent`, `pace`, required/actual pace, projection confidence/date і risk signals — Overview має виходити з цих наявних можливостей.
- **`reading-goals` залишається єдиним owner-ом goal calculations.** `statistics` не рахує повторно progress, pace, required pace, forecast/projection, risk або completion semantics із raw data; він отримує already-computed canonical metrics і адаптує їх для компактного Overview response. Якщо потрібного значення немає в Reading Goals capability — спочатку розширити canonical Reading Goals layer.
- На актуальному `dev` goal model є **count-based** (`targetCount` у книгах). Не проектувати books/pages/multi-type UI або contract наперед; якщо такі goal types з'являться в майбутньому, Statistics адаптується до їх canonical domain contract окремою зміною.
- Frontend не рахує progress, pace, required pace, forecast або risk/status самостійно.
- Status wording нейтральний і практичний: `За планом`, `Поточний темп достатній`, або конкретне пояснення required/current pace без judgement.
- Forecast не показувати при недостатній історії/confidence; contract повертає `availability = unavailable` + typed reason (`LOW_CONFIDENCE`/`INSUFFICIENT_SAMPLE`), UI — чесний unavailable state.
- Completed goal: `Ціль досягнуто`, final progress і дата досягнення; без надмірної gamification.
- Якщо активних цілей кілька: `Ще N активних` → сторінка цілей.
- Якщо цілі немає: actionable empty state `Створити ціль`.
- Comparison з попередніми goals на Overview не показувати.
- CTA → деталі конкретної цілі / сторінка Reading Goals.
- Mobile: той самий компактний progress layout без окремої складної композиції.

## 20. Стан колекції / Ownership

Окрему секцію `Стан колекції / Ownership` на Overview **не створювати**.

- Не дублювати тут Wishlist count, In Transit, Borrowed/Lent, ownership distribution/donut або collection growth.
- Operational counts залишаються на відповідних сторінках BookNest; глибока collection analytics — у майбутній вкладці статистики **Бібліотека**.
- Найцінніший ownership-related контекст інтегрувати в уже погоджений `Баланс бібліотеки`.

### Уточнення до №13 `Баланс бібліотеки`

- Current snapshot може показувати: `87 із 186 власних книг ще не прочитано`.
- Optional secondary metric: `53% власної бібліотеки прочитано`.
- Denominator = canonical **active/non-deleted** owned books (`Book.deletedAt IS NULL`) eligible for current reading-state statistics; не змішувати wishlist/transit та інші нееквівалентні ownership states. Historical reading facts of later-deleted books remain in historical Statistics and are not part of this current snapshot denominator.
- `OWNED + FINISHED` входить у current read ratio незалежно від того, чи книгу прочитали до або після придбання.
- DNF не входить у `прочитано`; деталізацію інших reading states можна залишити в details/майбутній вкладці.
- Current collection snapshot чітко відрізняється від historical period metrics.

### Майбутня вкладка `Бібліотека`

Потенційно: ownership distribution, collection growth, owned/read ratio, wishlist/acquisition rate, collection formats/publishers, bought-vs-read, TBR age, найдовше непрочитані книги.

## 21. Порівняння періодів

Окрему секцію `2026 vs 2025` на Overview **не створювати**. Comparison — глобальний cross-page analytics mode.

- У global header: `Порівняти` toggle.
- OFF: без deltas, previous-period series та comparison insights.
- ON: comparison context отримують релевантні компоненти.
- Показувати точний comparison scope, наприклад `Порівнюється з 01.01–18.08.2025`.
- Current year порівнюється лише з еквівалентною частиною попереднього року.
- Custom range → попередній interval такої самої тривалості; wording не називає його `минулим роком`.
- All time → comparison недоступний.

### Де використовується comparison

- KPI deltas.
- Previous-period series у `Динаміці читання`.
- Insight Engine.
- Значущі структурні зміни: genres, authors, languages, series share, active-day rate, ratings, TBR, discovery. Format trends додаються лише якщо reliable reading-format capability фактично існує.
- Comparison інформація залишається contextual біля відповідної метрики, а не дублюється в окремій таблиці.

### Backend comparison rules

Canonical edge behavior is defined by `shared/24-period-comparison-edge-contract.md`: explicit reversed/future custom ranges are rejected, one-day range is valid, All time cannot compare, previous-period ranges use equal inclusive calendar-day counts, leap-day same-year comparison uses calendar clamping, zero baseline returns `percentDelta = null`, and rates use percentage-point deltas. Frontend renders backend-normalized comparison bounds.

- significance thresholds;
- minimum sample;
- diversification;
- rank shifts;
- rate-based comparison там, де raw counts можуть вводити в оману.
- Не створювати insight для незначущих змін.
- Відрізняти `нове відносно previous period` від `вперше за lifetime`.
- Rating changes формулювати фактологічно без психологічних інтерпретацій.
- TBR comparison може бути candidate для Insight Engine, а не окремою comparison card.

## 22. Завершення Overview та Annual Reading Recap

Окрему recap-секцію внизу Overview **не створювати**.

- Overview завершується одним із найемоційніших погоджених блоків — **Ваші рекорди**.
- Не дублювати наприкінці Hero/KPI/Insights/Ratings у форматі ще одного `Ваш рік у книгах`.
- Після Records окремий великий footer/card не потрібний.

### Майбутня функція: Annual Reading Recap

`Ваш рік у книгах` зафіксувати як окремий майбутній storytelling experience, а не частину звичайного Overview.

- Доступний для завершених календарних років.
- Використовує ті самі backend statistics aggregates.
- Fullscreen/storytelling UX із послідовними екранами: books, pages, active days, genres, discoveries, records, top-rated covers тощо.
- Потенційно shareable із генерацією окремої recap-card.
- Для завершеного року Hero може мати subtle CTA `Переглянути підсумок року`, якщо recap доступний.
- Поточний незавершений рік не отримує постійний Annual Recap CTA.
- Hero = швидкий snapshot period; Annual Recap = емоційна історія завершеного року.

## 23. Фінальна desktop-композиція Overview

### Інформаційна ієрархія

`Підсумок → Динаміка → Поведінка → Смаки → Прогрес → Колекція → Персональні підсумки`.

### Порядок зверху вниз

1. **Page header + Period + Comparison** — page-level controls; comparison scope показується явно.
2. **Hero** — 12/12.
3. **4 KPI** — 4 × 3/12.
4. **Інсайти** — 12/12 container, до 4 cards.
5. **Динаміка читання + Ціль читання** — 8/12 + 4/12.
6. **Читацький календар** — 12/12.

Section divider: **Ваші читацькі смаки**

7. **Оцінки** — 12/12; internal split для rating analytics + top-rated covers. Favorite-state analytics не входить у guaranteed V1.
8. **Жанри + Автори** — 6/12 + 6/12.
9. **Видавництва + Мови** — 6/12 + 6/12. Formats не резервують окрему V1 card; optional section додається лише після появи reliable reading-format capability.
10. **Нові відкриття** — 12/12; до 3 discovery cards.

Section divider: **Ваш прогрес**

11. **Серійне читання** — 12/12.
12. **Баланс бібліотеки** — 12/12 compact horizontal flow.
13. **Ваші рекорди** — фінальна секція; 4 × 3/12 editorial cards.

### Layout principles

- Не використовувати sticky right sidebar: charts/calendar потребують ширини.
- Не використовувати masonry: порядок аналітики має бути стабільним.
- Не додавати drag-and-drop/custom dashboard у V1.
- Не примушувати всі cards до однакової висоти; компоненти мають природну висоту відповідно до типу даних.
- Hero, Calendar, Ratings, Series та Balance отримують full width там, де це покращує читабельність.
- Парні аналітичні блоки (`Genres + Authors`, `Publishers + Languages`) використовують 2-column composition. Conditional Formats не повинні ламати або резервувати місце в guaranteed V1 grid.
- Overview завершується `Вашими рекордами`; додатковий recap/footer card не потрібний.

## 24. Mobile composition

- KPI: 2×2.
- Insights, Discoveries, Records: horizontal swipe.
- Rankings: Top 3 + expand to Top 5.
- Series: summary + expand.
- Desktop popovers become mobile bottom sheets.
- Calendar keeps `Активність | Книги`; Books mode on mobile uses vertical reading diary/timeline.
- Same semantic order as desktop; presentation changes, analytics availability does not.

## Deterministic ordering invariant

Every ordered Statistics output follows `shared/23-deterministic-ordering-policy.md`: semantic ranking keys + a canonical non-localized stable final key. Frontend must not repair unstable backend order. Paginated exact details include the final stable key in backend cursor/order semantics.
