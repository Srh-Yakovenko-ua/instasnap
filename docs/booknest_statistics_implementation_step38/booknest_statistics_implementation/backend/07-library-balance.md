# Library balance / TBR

## Critical rule

Do not implement historical TBR balance until canonical ownership/TBR transition history is verified.

`Book.createdAt` and `updatedAt` are not replacements for lifecycle events.

## Desired model

All **current** library/TBR snapshot populations explicitly exclude soft-deleted Books (`Book.deletedAt IS NULL`). Historical reading facts are governed separately by `shared/18-soft-deleted-book-eligibility.md` and are not retroactively removed by soft delete.

- inflow: book entered owned + not-finished TBR in period;
- outflow: book left TBR for a canonical reason;
- net change;
- current owned TBR snapshot;
- current owned total — active/non-deleted Books only;
- current read ratio — both numerator and denominator use active/non-deleted current-library Books only;
- optional DNF outflow reason.

## V1 fallback

If reliable event history is absent:

- return current snapshot;
- return period flow using the canonical quality contract: `availability = unavailable`, `data = null`, reason `HISTORY_NOT_TRACKED`;
- do not create a parallel `historyAvailability` field or an `insufficient` availability value;
- do not fabricate inflow/outflow/net-change;
- optionally add event tracking/migration for future accumulation.

## Forecast

Estimate how long current TBR would last using a recent sustainable **TBR-reducing first-completion/outflow rate**, not the global `completedReads` rate. A reread of an already-read book is real reading activity but does not remove another unread book from the current backlog and MUST NOT make the TBR forecast artificially faster.

Rules:

- prefer canonical TBR outflow caused by a **proven first completion** when reliable lifecycle history exists; follow `shared/26-first-book-completion-reliability.md`;
- do not substitute `firstKnownBookCompletion` as a proxy when legacy first-ever status is unknown; if a reliable unread → first-read transition cannot be proven, downgrade the outflow/forecast capability via availability rather than guessing;
- rolling 12 months when available;
- require minimum history/sample;
- when confidence/sample is insufficient, return the forecast as `availability = unavailable`, `data = null`, with typed reason such as `LOW_CONFIDENCE` or `INSUFFICIENT_SAMPLE`.

This is not a prediction of when the whole future library will be completed.
