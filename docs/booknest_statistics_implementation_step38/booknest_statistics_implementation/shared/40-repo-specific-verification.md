# Repo-specific verification and migration gates

This package must follow the **current root `CLAUDE.md`** at implementation time. These rules are repeated here because ReadingCycle/Statistics is contract- and migration-heavy.

If root repo instructions change, current repo instructions win.

## Local per-change gates

Run the repo's cheap gates:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm exec vitest run <only touched/relevant test files>
```

Do **not** routinely run full `pnpm test` or `pnpm knip`. Those are opt-in according to current repo rules (user request, CI reproduction, or release gate).

## Contract blast radius

This implementation changes contract-shaped surfaces including some combination of:

- `packages/shared` schemas/types;
- Prisma schema/migrations;
- repository/service signatures;
- DI constructors;
- API request/response shapes;
- generated OpenAPI/Orval client;
- shared date/history helpers.

Therefore run the repository **`/blast-radius`** workflow before each commit-sized contract milestone and again before backend "done".

Do not limit validation to files manually opened in the Statistics feature.

## Spec workflow / delegation

Because the work arrives as a specification package, follow the repo `spec-to-ship` / `spec-auditor` workflow before coding and again before declaring done. Use the required backend/migration/test reviewers described by the current root rules.

## Prisma migration gate

For every schema migration:

1. use the repository's `db-migrate` / migration-reviewer process;
2. create migration SQL without blindly deploying it;
3. inspect every generated `DROP INDEX` / destructive statement;
4. preserve unrelated raw/partial indexes;
5. explicitly add/review the ReadingCycle active-cycle partial unique index;
6. run migration reconciliation checks before enabling constraints that depend on clean data;
7. only then deploy through the project-approved command.

Do not assume Prisma schema alone represents all production indexes.

## API / generated client

After shared/controller contract changes:

- regenerate OpenAPI/Orval using `pnpm gen:api`;
- verify representative response fixtures parse through the actual shared Zod schema;
- run blast-radius consumers;
- do not hand-maintain compatibility DTOs in frontend.

## Backend runtime verification

In addition to focused tests:

- `pnpm dev:api` starts clean;
- health endpoint succeeds according to repo instructions;
- curl the affected Statistics/Reading endpoints and capture observed contract behavior;
- exercise create/update/start/progress/finish/reread/reset/bulk/correction paths that changed lifecycle storage.

## Frontend runtime verification

When frontend work begins:

- `pnpm dev:web` starts clean;
- no console errors;
- verify Statistics UI visually for changed behavior;
- test cache invalidation after source-feature mutations.

## Completion rule

Never claim this package implemented with a failing required gate. If a failure is unrelated/pre-existing, document the observed failure explicitly rather than treating it as passed.
