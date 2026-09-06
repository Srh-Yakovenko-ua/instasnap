# Claude Code frontend execution plan

1. Read current frontend agent/rules and nearest features.
2. Confirm generated Statistics hooks/models exist.
3. Create/align the Statistics feature with the domain-oriented component ownership from `frontend/01-feature-structure.md` and `frontend/11-component-map.md`; do not introduce a generic top-level `charts/` bucket.
4. Add Statistics route + messages.
5. Wire centralized Statistics query invalidation per `frontend/12-query-invalidation.md`: add/reuse one matcher/helper for the full `/api/statistics` query family and integrate it into successful Book/Reading, Goal, Series and profile mutation-sync paths. Do not patch aggregate caches manually.
6. Implement period/comparison header and URL state. Apply `shared/16-reading-date-semantics.md`: treat returned `YYYY-MM-DD` values as date-only keys and use date-only-safe formatting; do not timezone-shift them through browser `Date` parsing.
7. Build Overview shell in final desktop/mobile order.
8. Implement Hero/KPI/Insights; map generated typed Insight `code + params` to `next-intl` messages, with no backend-text fallback. Treat `hero.featuredInsight` + `insights.items` as an already-selected projection of one backend ranked pool; do not rerank, dedupe or promote on frontend.
9. Dynamics + Goal.
10. Calendar from Overview `booksPreview` + `remainingBooksCount`; lazy full day details only after interaction + mobile diary. Assert no per-visible-day request fan-out.
11. Ratings (`Оцінки`, no Favorites analytics in V1)/Genres/Authors/Publishers/Languages. Languages render canonical backend enum values through i18n and follow `shared/22-language-reliability-semantics.md`; do not infer confirmation provenance or reclassify default Ukrainian. Formats are optional only when backend exposes a reliable actually-read-format capability; do not block V1 on them.
12. Discoveries/Series/Library Balance/Records.
13. Apply responsive progressive disclosure.
14. Add tests and run full verification.

Do not start with pixel polish before data states and interactions work.
Do not duplicate backend calculations for convenience.

Before wiring clickable analytics rows/bars, implement the centralized typed Statistics drill-down builder from `shared/10-exact-drilldown-contract.md`. Never hand-build approximate URLs per component.

- Apply `shared/25-completed-read-count-semantics.md`: render `completedReads` with read/read-through wording, show `uniqueBooksCompleted` only as explicit distinct-book context, and label Dynamics count mode `Читання`.
