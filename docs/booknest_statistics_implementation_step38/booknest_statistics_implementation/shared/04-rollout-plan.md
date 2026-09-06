# Rollout plan

## Backend-first milestone

Before Statistics aggregate rollout, land the mandatory Books/Reading prerequisites: user-local date semantics (`shared/16-reading-date-semantics.md`) and canonical reading-cycle history (`shared/17-reading-cycle-history.md`). Apply the V1 declared-edition-language semantics and pre-release distribution sanity audit from `shared/22-language-reliability-semantics.md`; do not block rollout on inventing legacy confirmation provenance.

Ship/merge:

- shared contracts;
- statistics module;
- tests;
- OpenAPI;
- generated client.

Frontend begins only after this milestone.

## FE milestone

Ship Overview using stable generated contract.

## Deferred / conditional

Do not block whole Statistics page on these if data model cannot support them yet:

- historical TBR balance;
- any reading-format analytics; guaranteed V1 ships without Formats unless a reliable actually-read-format source already exists after audit;
- original-language metrics;
- advanced goal types not present in current domain;
- annual shareable recap.

Expose graceful states through the canonical shared availability/coverage contract or omit optional subsections until canonical data exists.

## Reading-history prerequisite rollout

The concrete additive-schema → canonical-write → mutation-verification → idempotent-backfill → reconciliation → Statistics-enable sequence is mandatory and defined in `shared/29-reading-history-migration-rollout.md`. Do not enable completion/rating/ranking Statistics against partially migrated mutable history.
