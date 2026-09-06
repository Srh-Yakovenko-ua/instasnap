# Reading Format capability — conditional V1 rule

## Decision

Reading-format analytics are **not part of guaranteed V1 Statistics Overview**.

Current `Book.formats[]` must be treated as metadata about available/owned book formats unless the current domain explicitly proves otherwise. It is not sufficient evidence of the format used for a specific completed reading.

## Guaranteed V1 behavior

- Languages ship independently of Formats.
- No `readingFormat` migration is created only to satisfy Statistics V1.
- No empty/unavailable Formats card is reserved in desktop or mobile layout.
- No frontend heuristic selects the first/single/multiple value from `Book.formats[]` as the actually-read format.
- Missing format semantics do not block `/statistics/overview` or page acceptance.

## When Formats may be enabled

Only enable the optional capability when backend audit identifies a canonical reliable source tied to the actual reading/edition. Then:

1. expose a typed optional `formats` section/capability;
2. use the global Statistics period and completed-read eligibility rules;
3. use `available | partial | unavailable` plus canonical coverage;
4. preserve exact drill-down membership;
5. add format trends/insights only from the same reliable observations;
6. add tests proving no fallback to `Book.formats[]` ambiguity.

This is a capability gate, not a new availability vocabulary and not a prerequisite for the rest of Statistics.
