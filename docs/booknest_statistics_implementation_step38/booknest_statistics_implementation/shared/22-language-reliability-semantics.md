# Language reliability and default semantics

This file defines the V1 meaning of the guaranteed **Languages / Мови** section. It closes an important gap between the product model and Statistics data-quality wording.

## Current `dev` facts

The current Books domain does **not** model language as optional metadata:

- `Book.language` is non-null and has Prisma default `"ukrainian"`;
- `CreateBookInputSchema.language` defaults to `"ukrainian"`;
- the frontend create-form defaults also set `language: "ukrainian"`;
- the Classification section renders a visible language Select; its empty/fallback value and clear action resolve back to `"ukrainian"`;
- canonical values come from `BookLanguageSchema`: `ukrainian | english | polish | german | french | spanish | other`.

Therefore the current model cannot distinguish these historical cases from stored data alone:

1. the user explicitly chose Ukrainian;
2. the user saw the default Ukrainian value and accepted it without interaction;
3. an older/imported flow persisted the application/schema default without an independently recorded confirmation event.

Statistics MUST NOT invent that missing provenance.

## V1 product definition

The canonical V1 metric is **declared edition language**, not “verified language” and not original-work language.

For a finished reading cycle:

> `declaredEditionLanguage = cycle.completionMetadata.language`

where the cycle snapshot captures the canonical `Book.language` value at completion according to `shared/19-historical-metadata-snapshots.md`.

User-facing copy should describe the value honestly, for example:

> **Мова видання, зафіксована в BookNest на момент завершення читання.**

Do not claim that Statistics has proof the user manually confirmed each value.

## Default `ukrainian` semantics

`ukrainian` remains a real canonical BookLanguage value. Statistics MUST NOT reinterpret every `ukrainian` value as `unknown` merely because it is also the current product default. There is no reliable evidence that would separate explicit Ukrainian from defaulted Ukrainian in legacy rows.

Likewise, Statistics MUST NOT use heuristics such as:

- `language === "ukrainian"` → unknown;
- old `createdAt` → probably defaulted;
- title/author/publisher text → infer another language;
- UI locale/account locale → infer book language.

Such rules would replace one uncertainty with fabricated data.

## Coverage meaning

Language `coverage` means **snapshot completeness**, not user-confirmation confidence.

Canonical denominator:

- `eligibleCount` = completed reading cycles eligible for the Languages aggregate;
- `knownCount` = those cycles whose immutable completion snapshot contains a valid canonical `BookLanguage` value;
- `percent = knownCount / eligibleCount`.

For normal post-prerequisite cycles, `Book.language` is non-null and the completion snapshot should normally make language coverage 100%. `partial` is still valid for legacy/backfilled/corrupt/incomplete snapshots where language genuinely cannot be captured.

Do **not** show a misleading `20 із 37 читань мають дані про мову` caption merely to represent uncertainty about whether a default was explicitly confirmed. If all 37 snapshots contain valid canonical language values, completeness coverage is 37/37 even though legacy confirmation provenance is unknowable.

Do not introduce a separate pseudo-percentage such as `confirmedCoverage` without a canonical Books-domain provenance model.

## Historical stability

The completion-time snapshot rule remains mandatory:

- finish cycle with stored language X → snapshot X;
- later edit current Book to language Y → old period remains X;
- soft delete does not remove the historical language fact;
- exact drill-down preserves the same snapshot membership.

For conservative legacy cycle backfill, capture the current canonical `Book.language` once with the existing `legacy_current_metadata` provenance and freeze it. This is best-effort legacy metadata, not proof that the value was the original historical selection.

## `new language` / discoveries

Any `new language` insight/discovery uses canonical first-completion history and the frozen declared-edition-language snapshot. Do not use current mutable Book language to rewrite earlier first exposure.

For `All time`, keep the existing rule that `new language` semantics are not shown.

## Original language

Current `Book.language` does not mean original-work language. Do not derive `originalLanguage` from author/title/publisher or infer “read in original” from `Book.language`. Original-language analytics remain deferred until a separate reliable canonical source exists.

## No Statistics-only provenance migration

Do not add `languageConfirmed`, `languageSource`, `languageVerifiedAt` or make `Book.language` nullable solely to satisfy Statistics V1. The current Books product model already defines a required visible edition-language field.

If the product later wants to distinguish **explicitly confirmed** vs **defaulted/imported/unknown** language, that must be a separate Books-domain product/data-model decision. At that point Statistics may consume the new canonical provenance, but it must not invent one locally.

## Pre-release audit

Before shipping Languages, run a simple data audit over representative/test data and record the distribution of canonical values, especially the share of `ukrainian`. This is a sanity check for migration/import anomalies, not a heuristic that reclassifies data.

If obviously malformed/non-enum legacy values exist outside current shared validation, normalize only from trustworthy source data; otherwise mark that snapshot language unavailable rather than guessing.

## API / frontend rules

- Return canonical `BookLanguageSchema` values (`ukrainian`, `english`, ...), not invented abbreviations such as `uk`/`en`.
- Localized labels belong to frontend i18n.
- Percentages are shares of known snapshot language values.
- A missing legacy snapshot language is not rendered as a fake `Не вказано` language category. It contributes to coverage only.
- Do not offer `Доповнити дані` for a historical cycle unless an explicit historical-metadata correction flow actually exists; ordinary current Book edit must not mutate a finalized cycle snapshot.

## Required tests

At minimum:

1. new completed cycle with `ukrainian` is a valid Ukrainian language observation;
2. Statistics does not reclassify `ukrainian` as unknown merely because it is the default;
3. canonical response uses `ukrainian`/`english`, not `uk`/`en`;
4. completed cycle snapshot language remains stable after current Book language edit;
5. legacy snapshot with genuinely missing/invalid language reduces `knownCount` and yields `partial`;
6. 37 valid language snapshots produce 37/37 completeness even if many are Ukrainian;
7. no original-language/read-in-original metric appears without a separate reliable source;
8. cross-user isolation holds for language aggregates and drill-down.
