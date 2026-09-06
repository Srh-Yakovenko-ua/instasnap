# Ratings, genres, authors, publishers

Historical taste/rating aggregates are reading-history metrics. A later soft delete of the related Book does not remove an already finalized reading cycle/first-completion fact from the historical period. Author/genre/publisher/language membership for completed reads comes from the immutable completion-time metadata snapshot in `shared/19-historical-metadata-snapshots.md`, not from today's mutable Book relations. Apply canonical coverage for genuinely missing snapshot metadata. See also `shared/18-soft-deleted-book-eligibility.md`.

## Ratings

Canonical BookNest rating scale: **0.5–10.0**, step **0.5**. Historical Statistics uses the canonical **completed-cycle rating** from `shared/17-reading-cycle-history.md` and must not derive old-period ratings only from the mutable latest `BookReadingProgress.rating`. Do not convert to a 5-star scale.

- average rating + canonical coverage, displayed as `x.x / 10`; with rated subset smaller than completed subset return `availability = partial`; with zero rated books return `availability = unavailable`, `value = null`, reason `NO_RATINGS`;
- distribution by canonical rating value (`10.0`, `9.5`, `9.0`, ... `0.5`) or a lossless UI grouping derived from that scale;
- share of rated completed reads with a high rating: **`rating >= 8.0`**;
- up to 4 top-rated completed reads;
- sorting: `cycle.rating DESC → cycle.finishedAt DESC → readingCycleId ASC`.

DNF не включати в Overview ratings.
Do not introduce `1–5★`, `4–5★`, or any other parallel rating semantics in Statistics.

## Genres

Historical genre membership uses the cycle's completion-time genre snapshot. Editing `Book.genres[]` later must not move old cycles between genre rankings/discoveries.

Frequency:

- top 5 by count of completed reads whose completion snapshot contains the genre;
- deterministic order: `completedReadCount DESC → genreKey ASC`;
- multi-genre book counts for every relevant genre;
- optionally `shareOfCompletedReads`, яке не мусить сумуватися до 100%.

Rating:

- average rating by genre;
- minimum 3 rated completed reads;
- deterministic order: `averageRating DESC → ratedReadCount DESC → genreKey ASC`.

Discovery:

- genre is new only when a **proven `firstBookCompletion`** occurs in current period and no earlier proven first completion exposed that genre; `firstKnownBookCompletion` from incomplete legacy history is insufficient. Follow `shared/26-first-book-completion-reliability.md`.

## Authors

Historical author membership uses completion-time snapshot author identities. Current author names may enrich labels when identity is unchanged, but current `BookAuthor` relations must not redefine old aggregate membership.

Frequency:

- top 5 authors by completed-read count;
- deterministic order: `completedReadCount DESC → authorId ASC`;
- co-authored book counts +1 for each author.

Rating:

- minimum 3 rated completed reads;
- deterministic order: `averageRating DESC → ratedReadCount DESC → authorId ASC`.

Discovery:

- new author = a **proven `firstBookCompletion`** that first exposes that author occurs in period; unknown legacy first-ever status does not fabricate discovery, and rereads do not create another discovery.

Return author:

- lifetime metric;
- deterministic order: `distinctReadingYears DESC → completedReadCount DESC → latestFinishedAt DESC → authorId ASC`.

## Publishers

Historical publisher membership uses the completion-time publisher snapshot. A later `Book.publisherId` edit must not rewrite an earlier period.

- top 5 by completed-read count (behavioral ranking may include rereads);
- deterministic order: `completedReadCount DESC → averageRating DESC NULLS LAST → publisherId ASC`; `averageRating` participates only when canonically available/eligible, and current/display name is never the final tie-break;
- secondary average rating when sample is adequate (target ≥2 rated completed reads);
- discovery/new-publisher semantics use **proven** `firstBookCompletion`, not `firstKnownBookCompletion` or reread cycles;
- total represented publishers;
- top-3 concentration;
- unknown publisher excluded from ranking;
- return canonical metadata coverage `{ eligibleCount, knownCount, percent }`; use `partial` when unknown publishers exist but ranking remains reliable for the known subset.

Не створювати окремий publisher rating ranking.

## Languages

Follow `shared/22-language-reliability-semantics.md`. V1 Languages is the distribution of the **declared edition language captured in the finished cycle's immutable completion snapshot**. It is not proof that the user manually confirmed the field and it is not original-work language.

- use canonical `BookLanguageSchema` values only: `ukrainian | english | polish | german | french | spanish | other`;
- count completed cycles by snapshot language; rereads are behavioral completed reads and therefore contribute when they are completed in scope, using that cycle's frozen snapshot;
- deterministic frequency order: `completedReadCount DESC → canonical BookLanguageSchema value ASC`; never sort ties by translated labels;
- `new language` semantics use first-completion history, not current Book metadata;
- never infer language from title/author/publisher, locale or formats;
- never reinterpret every `ukrainian` value as unknown merely because `ukrainian` is also the create/schema default;
- coverage means snapshot completeness only. Normal post-prerequisite cycles should normally have known language because current `Book.language` is non-null; `partial` remains valid for genuinely missing/invalid legacy snapshot language;
- do not expose a fake `Не вказано` ranking bucket; missing legacy language affects coverage, not categories;
- ordinary current Book edits do not repair/mutate historical snapshot language. A historical correction CTA exists only if an explicit correction capability is implemented;
- original-language/read-in-original analytics remain unavailable until a separate canonical source exists.

## Shared availability rule for tastes

Ratings, genre/author/publisher rating samples, publisher metadata and languages MUST use the same shared availability/coverage contract. Any future optional reading-format analytics uses the same contract only after a reliable actually-read-format source exists. Formats are not guaranteed V1. Minimum-sample failure is `availability = unavailable` with reason `INSUFFICIENT_SAMPLE`, not a separate `insufficient` state.

All ranking/detail arrays in this capability follow `shared/23-deterministic-ordering-policy.md`; product metric keys are followed by a canonical non-localized stable identity key so equal values cannot fall back to incidental DB/frontend order.

## Discovery reliability

All discovery metrics follow `shared/26-first-book-completion-reliability.md`. When legacy history prevents a defensible first-ever classification, return the discovery capability as `partial` or `unavailable` using the shared quality contract rather than treating the earliest known legacy cycle as a new discovery. Behavioral frequency/rating sections remain available from valid completed reads.
