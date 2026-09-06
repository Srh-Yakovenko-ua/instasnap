# Backend domain decomposition

## Мета

Statistics має залишатися feature-модулем із невеликими, зрозумілими одиницями бізнес-логіки. Не накопичуй незалежні правила календаря, streaks, ratings, tastes, series, library balance, insights і records в одному великому `statistics.service.ts`, `statistics.repository.ts` або іншому "god object".

Це **не** вимога створювати файл на кожну формулу і **не** дозвіл будувати generic analytics framework. Розбивай лише логічно незалежні capabilities, які мають власні invariants/eligibility/bucketing/ranking rules і можуть бути протестовані окремо.

## Межі шарів

### `application/`

Application layer оркеструє use case:

- отримує authenticated user/settings і normalized query;
- викликає focused repository/domain capabilities;
- компонує `/statistics/overview` response;
- адаптує canonical output інших feature domains (наприклад Reading Goals / Series), не копіюючи їхні формули;
- не містить Prisma queries і не стає місцем для великих незалежних analytics algorithms.

Overview service/composer має читатися як orchestration, а не як файл із усіма формулами Statistics.

### `domain/`

Domain layer містить pure або framework-independent Statistics rules, коли вони мають самостійну бізнес-семантику. Приклади можливих focused units:

- `statistics-period` / `statistics-comparison`;
- `reading-dynamics`;
- `reading-calendar` / `reading-streak`;
- `reading-ratings`;
- `reading-tastes` (або окремі author/genre/publisher units, якщо логіка справді відрізняється);
- `series-analytics` — лише Statistics-specific aggregation поверх canonical Series semantics;
- `library-balance`;
- `insight-engine`;
- `record-engine`.

Назви/кількість файлів не є контрактом. Агент повинен спочатку перевірити canonical patterns у `dev` і вибрати найменшу зрозумілу декомпозицію, яка відповідає реальній складності.

Domain units:

- не імпортують Prisma/NestJS/HTTP/frontend code;
- отримують explicit typed input;
- повертають typed deterministic output;
- не читають глобальний server timezone/process state;
- мають focused unit tests для власних rules/edge cases.

### `infrastructure/`

Infrastructure/repository layer:

- містить Prisma/SQL access;
- робить user/period filtering і aggregates у БД, де це доречно;
- може мати кілька focused query/repository methods за capability/source;
- не визначає product semantics, insight ranking, UI text або domain eligibility rules, які краще тестуються окремо.

Не роби один `getAllStatisticsData()`/`getEverything()` repository method, який повертає великий loosely-related bag даних лише для того, щоб потім application service сам розбирав усю бізнес-логіку.

## Коли виділяти окремий domain unit

Виділяй окрему одиницю, якщо виконується хоча б одна з умов:

1. Є власні eligibility/inclusion/exclusion rules.
2. Є самостійна bucket/threshold/ranking/selection semantics.
3. Є edge cases, які заслуговують focused unit tests.
4. Правило використовується у кількох місцях одного Statistics use case (наприклад Overview + detail endpoint).
5. Application service починає містити довгі незалежні calculation branches, які можна назвати окремою domain capability.

Не виділяй окремий module/file лише через 1–2 тривіальні expressions або щоб досягти "симетричної" структури.

## Тестова стратегія

- Pure/domain rules тестуються без БД.
- Repository tests перевіряють query scoping/aggregation shape, а не дублюють domain formulas.
- Application/service tests перевіряють orchestration, mapping, availability/coverage і composition.
- API/integration tests перевіряють contract, auth/user isolation і representative end-to-end cases.

## Hard acceptance

Backend Statistics не вважається завершеним, якщо:

- один великий service/repository фактично містить більшість незалежних analytics rules;
- pure calculation rules змішані з Prisma/Nest/HTTP concerns без необхідності;
- focused domain behaviors неможливо протестувати окремо без підняття БД/controller;
- декомпозиція створила generic analytics abstraction, яка не має щонайменше двох реальних BookNest use cases.
