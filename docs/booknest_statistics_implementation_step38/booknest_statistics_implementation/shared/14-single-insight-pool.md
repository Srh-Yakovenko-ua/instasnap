# Single Insight Engine ranked pool

## Purpose

Hero featured insight і звичайний блок Insights — це **дві presentation surfaces одного backend Insight Engine**, а не дві незалежні системи відбору.

## Canonical pipeline

Backend виконує один deterministic pipeline:

```text
candidates
→ eligibility
→ significance
→ minimum sample
→ dedupe/diversify
→ priority/ranking
→ rankedPool
```

Усі thresholds, sample rules, comparison availability, category diversification та business priority застосовуються **один раз до спільного candidate set**.

## Projection to Overview

Після побудови `rankedPool`:

1. `hero.featuredInsight` = перший ranked candidate, дозволений для featured presentation. Якщо всі V1 insight codes hero-safe — це `rankedPool[0]`. Якщо hero-eligible candidate немає — `null`.
2. `insights.items` = наступні найвищі candidates із того самого `rankedPool`, **без featured candidate**, максимум 4.
3. Semantic duplicate не може одночасно бути Hero і regular card.
4. Regular block може містити менше 4 cards, якщо pool недостатній або diversification/eligibility це вимагає.
5. Якщо Hero `null` через presentation eligibility, regular cards можуть усе одно існувати.

## Stable identity / dedupe

Кожен candidate повинен мати deterministic semantic identity, достатню для дедуплікації до projection. Це може бути внутрішній `candidateKey`/composite key на рівні engine; не обов’язково виставляти його в public HTTP contract, якщо він не потрібен frontend.

Не вважай два candidates різними лише тому, що один готується для Hero, а інший для regular card.

## Ownership

Backend owns:

- candidate generation;
- eligibility;
- significance;
- sample-size checks;
- dedupe/diversification;
- priority/ranking;
- featured/regular projection.

Frontend owns only:

- localized wording for `code + typed params`;
- layout/presentation;
- semantic action routing through existing exact drill-down rules.

Frontend MUST NOT:

- rerank;
- dedupe;
- replace featured with another card;
- promote a regular card into Hero;
- append featured back into the regular list.

## Tests

At minimum cover:

- highest-ranked candidate becomes featured and is absent from regular items;
- remaining items preserve backend ranking;
- dedupe/diversification happens before surface projection;
- insufficient pool returns fewer than 4 regular cards;
- no eligible candidate returns `featuredInsight = null`;
- when Hero is unavailable for presentation reasons but regular candidates exist, regular Insights still render deterministically;
- repeated execution over identical input produces the same featured + regular ordering.
