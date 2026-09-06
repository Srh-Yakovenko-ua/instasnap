# Data-quality rules

These are product rules, not implementation details.

- Use the canonical contract from `shared/09-availability-and-coverage-contract.md`; no section-local availability enums.
- `0` means known zero and therefore an `available` result.
- `unavailable` means not known/cannot be derived reliably; its metric value/data is `null`/omitted and a typed reason is required.
- `partial` means the result is valid only for a known subset; canonical coverage is required.
- Pages by period come only from progress events.
- Reading `@db.Date` fields/events are logical `YYYY-MM-DD` labels. Preserve and compare/group those labels directly; never timezone-shift a stored reading date or substitute event `createdAt` as its reading day.
- User timezone resolves implicit/new `today` and relative current-day boundaries. Books/Reading write defaults must use canonical `UserProfileSettings.timezone`, not UTC/server local time.
- Reading duration requires reliable start + finish.
- TBR historical flow requires lifecycle history.
- Reading-format analytics is not guaranteed V1. `Book.formats[]` alone is insufficient evidence of the format actually read; do not infer or fabricate it. Only enable the optional Formats capability from a canonical reliable actually-read-format source.
- Languages follow `shared/22-language-reliability-semantics.md`: use immutable completion-snapshot `BookLanguageSchema` values as declared edition language; percentages use known snapshot denominator, coverage measures completeness only, and `ukrainian` is not reclassified as unknown merely because it is the current default.
- Publisher unknown is not a publisher category.
- Series progress percentage requires reliable denominator/order.
- Small rating samples must not produce misleading `best` claims.

## Legacy reread history

After cycle tracking is introduced, existing data may still lack older read-throughs that were previously overwritten/erased by mutable progress/reset behavior. Backfill only known facts. Because the number of missing cycles is unknowable, do not fabricate an exact coverage percentage or reconstruct them from timestamps. Newly tracked cycle history is canonical going forward.

## Soft-deleted books

Soft deletion is not itself a data-quality failure. Historical canonical reading facts remain valid after a later `Book.deletedAt`; current-library snapshot eligibility excludes soft-deleted Books. Do not report historical facts as `unavailable` merely because the Book is soft-deleted. Use coverage/unavailable only when required metadata/facts are genuinely missing. See `shared/18-soft-deleted-book-eligibility.md`.
