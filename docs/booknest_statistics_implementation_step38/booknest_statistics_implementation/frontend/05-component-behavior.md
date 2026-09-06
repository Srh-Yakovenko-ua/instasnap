# Component behavior

## Hero

- dynamic period title;
- one backend-selected featured insight using the shared typed `code + params` Insight contract; it is already selected from the same backend ranked pool as regular Insight cards;
- frontend renders the localized insight sentence through `next-intl`; do not expect a backend `text` field;
- up to 4 recent completed covers (mobile 3 where needed).

## KPI

Non-clickable:

- completed reads: primary `completedReads` rendered with read/read-through wording; supporting `uniqueBooksCompleted` rendered explicitly as distinct books, not as another KPI card;
- pages;
- average rating;
- active days.

The frontend must not rename or reinterpret `completedReads` as a distinct-book count and must not derive `uniqueBooksCompleted` by deduplicating UI rows.

## Insights

- consume the generated discriminated Insight union from the API client;
- render wording by mapping stable `code` to explicit `next-intl` messages;
- format numbers, percentages, dates and plurals on frontend according to locale, using raw typed `params` from backend;
- do not reconstruct eligibility/significance/ranking or any business metric from params;
- do not rerank/dedupe/promote a regular card into Hero or reinsert the featured candidate into `insights.items`; render the backend selection as-is;
- do not add a fallback that displays arbitrary backend-provided text;
- optional actions use semantic typed targets; primary analytics actions obey the exact drill-down contract, while broader navigation is rendered as a separate context action. Route construction goes through the centralized Statistics drill-down builder.

## Dynamics

- bars current;
- comparison line when enabled;
- `Читання | Сторінки`; completed-count bars use canonical `completedReads`, while `uniqueBooksCompleted` is separate supporting context;
- tap/hover tooltip;
- selected bucket may open exact detail UI/filtered navigation only when the destination reproduces that bucket's canonical subset; otherwise stay in Statistics details and expose broader navigation separately.

## Calendar

Segmented:

- `Активність` heatmap;
- `Книги` visual diary.

Desktop books mode: month grid. Weekday columns/order MUST follow resolved canonical `meta.weekStartDay` from the Statistics Overview response (`monday | sunday`); do not hardcode Monday-first layout. Render each day directly from Overview `booksPreview` (max 3) and show `+N` from `remainingBooksCount` when needed. Do not fetch day details just to obtain covers for the grid.
Mobile books mode: vertical reading diary/timeline built initially from the same Overview day previews; days with more books may show `+N`/summary and open full details on interaction.
Heatmap/week-aligned presentation must use the same week-start semantics as backend weekly aggregates.
Consume backend `calendar.metricRange` and `calendar.displayRange`; never infer KPI scope from the rendered day-cell range. In All-time mode, make the bounded last-12-month `displayRange` explicit while Calendar summary KPI values remain scoped to `metricRange`.
`currentStreak` is shown only when backend marks it `available`. For a closed historical period (`PERIOD_NOT_CURRENT`) hide/reflow that KPI rather than rendering `0`. If `continuesBeforeRange = true`, do not imply the clipped value is the full streak; use an appropriate localized continuation treatment (for example `7+ днів`).
Full day details come from the lazy API **only after click/tap/open-details**; there must be no per-visible-day request fan-out.

## Ratings

Distribution + coverage + top-rated covers.
Use the canonical BookNest `0.5–10.0` rating scale with `0.5` step; display averages as `x.x / 10`. Do not convert values to a 5-star scale.
The high-rating share uses `rating >= 8.0`.

## Rankings

Genres/authors segmented; publishers single ranking.
Do not compute percentages/sample eligibility on FE.

## Languages

Render canonical `BookLanguageSchema` values from backend through i18n labels. The section means **declared edition language captured at reading completion**; use an honest helper/caption such as `Мова видання, зафіксована в BookNest на момент завершення читання.`

Do not:

- map `ukrainian` to unknown because it equals the current default;
- infer language from title/author/publisher/browser locale;
- display API abbreviations such as `uk`/`en` when the contract returns `ukrainian`/`english`;
- do **not** show `Не вказано` as a ranking category for missing legacy snapshot data; missing values affect coverage only;
- treat coverage as proof of explicit user confirmation.

A partial-language caption is shown only for genuinely incomplete historical snapshots. Ordinary Book edits must not be presented as a way to rewrite a finalized historical snapshot unless an explicit correction flow exists. See `shared/22-language-reliability-semantics.md`.

## Availability / coverage behavior

Components consume the canonical shared quality fields. Do not derive data quality from `value == null`, empty arrays, or local thresholds. `partial` content stays visible with coverage; `unavailable` uses the section reason state; `available` known zero remains a real zero/empty result.

## Completed-read / reread presentation

The primary KPI/dynamics count is `completedReads` and comes from completed reading cycles. `uniqueBooksCompleted` is distinct by `bookId`; frontend never derives one from the other. Do not deduplicate aggregate values by `bookId` on frontend. Hero may avoid showing the same cover twice purely as a visual composition choice, but that must not change KPI/dynamics counts or exact-detail membership. Exact details preserve cycle identity.

Historical book/result components must consume backend `bookState: active | soft_deleted`; a soft-deleted source Book remains renderable in exact Statistics details but broader normal-Book navigation is omitted when unsupported. Do not infer this state on the client.

## Cache freshness / invalidation

Statistics components do not own cross-feature cache synchronization. Consume query results only. Successful mutations in Books/Reading, Reading Goals, Series, relevant entity metadata and profile `timezone/weekStartDay` must invalidate the Statistics query family through centralized API/mutation-sync helpers as defined in `frontend/12-query-invalidation.md`.

Do not manually patch aggregate Statistics values in React after another feature mutates canonical data.

## Ordering

Rankings, records, previews and exact-detail default rows preserve the order returned by backend according to `shared/23-deterministic-ordering-policy.md`. Frontend MUST NOT apply locale/name/client-side tie-break sorting to analytics rankings. Only an explicit user-selected detail sort may change presentation order, while preserving exact membership.
