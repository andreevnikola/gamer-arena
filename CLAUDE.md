# GamerArena

Esports tournament platform: teams register, brackets are generated, scores are confirmed by both sides.
Next.js (App Router) + strict TypeScript + PostgreSQL (Neon) via Drizzle. Sprint 1 = data and business layers (+ one read-only showcase page).

@AGENTS.md

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| First run / reset demo DB | `npm run setup` / `npm run db:reset` |
| New migration after editing `src/data/schema.ts` | `npm run db:generate` (commit `drizzle/`) |
| Verify before finishing | `npm run typecheck && npm run lint && npm test` |
| Coverage | `npm run test:coverage` |

## Architecture

One-way dependencies, enforced by ESLint (`no-restricted-imports`):
**Presentation → Business → Repositories → Data**. Nothing imports upward or skips a layer.

| Layer | Path | Rule |
|---|---|---|
| Presentation | `src/app`, `src/components` | Reads data through services only, via `@/composition`. |
| Business | `src/business` | All rules. Depends on repository *interfaces* + entity types. No DB imports. |
| Repositories | `src/repositories` | `IRepository<T>` (async CRUD) + `DrizzleRepository<T>`; specific queries only. No logic. |
| Data | `src/data` | Drizzle schema, DB factory, migrations. |
| Composition root | `src/composition.ts` | Only file that wires every layer. |

Decisions:
- Roles are a `users.role` column (`player | organizer | admin`), not ASP.NET Identity. Auth/sessions: later sprint.
- `matches.nextSlot` (A/B) was added to the ERD so winners know which slot to fill.
- 1v1 entrants are solo teams (`isSoloEntry`), so `Match` always references `Team`.
- Services take `Repositories` and a `Clock`; never call `new Date()` inside a service.
- Expected failures throw `DomainError(code, message, fields)`; codes: `validation | not_found | forbidden | conflict | invalid_state`.
- Multi-write operations use `repos.unitOfWork.run(...)`. The callback may only await repository calls. Repositories join the transaction through `DbContext` (AsyncLocalStorage); units of work are serialised by an advisory lock.
- Migrations are applied with `npm run db:migrate` (direct Neon URL), never at app start. App uses `DATABASE_URL_POOLED`.
- Pure logic stays pure and separately testable (`bracket.ts`, `validation.ts`, `evaluateRegistration`).
- `cacheComponents` is on: DB reads go inside `<Suspense>` after `await connection()`.
- Schema change = edit `schema.ts` → `db:generate` → commit migration. Never edit an applied migration.
- The ERD/architecture document in Google Docs is the source of truth. Update it when schema or architecture changes (link in README).

## Design system

Modern, minimal, one accent. **Chalk & Cobalt**, defined once as tokens in `src/app/globals.css` (light + dark).

| Token | Light | Use |
|---|---|---|
| background / card | Chalk `#F5F7F9` / white | Page / surfaces |
| foreground | Midnight `#0C1628` | Text |
| muted-foreground | Slate `#596475` | Secondary text |
| border | Mist `#E3E6EC` | Borders, connectors |
| primary | Cobalt `#2852F0` | Actions, winners, focus |
| success / warning / destructive | functional only | Status, never decoration |

Rules:
- **Always invoke the `frontend-design` skill before UI work.**
- Build only from shadcn/ui (`npx shadcn@latest add <component>`; `src/components/ui`). Do not hand-roll buttons, tables, badges.
- No hex or arbitrary colours in components; use token classes (`bg-primary`, `text-muted-foreground`).
- Type: Bricolage Grotesque for headings (`font-heading`), Geist for UI, tabular numerals for scores.
- No gradients, drop shadows, or second accent. Cards use the default ring. Radius from `--radius`.
- Must work in light and dark, on mobile, with visible focus and reduced motion respected.
- Copy: sentence case, plain verbs, name things the way users do.

## Testing

Vitest, `tests/` mirrors `src/`. A change is not done until `typecheck`, `lint` and `test` pass.

| Level | Where | How |
|---|---|---|
| Pure unit | `tests/business/validation`, `bracket` | No I/O. Boundaries and invariants (bracket checked for every size 2–40). |
| Service unit | `tests/business/*-service` | In-memory fakes from `tests/helpers/fakes.ts`. One test per rule and per error code. |
| Repository integration | `tests/repositories` | Real Postgres (PGlite, in-process) + real migrations via `await useTestDb()`. Assert constraints, cascades, rollback. |
| Flow integration | `tests/integration` | Services on real Postgres (PGlite): full tournament, atomic start, seed. |

Policy: every business rule has a passing and a failing test; bug fix starts with a failing test; no mocking the DB in repository tests; deterministic (inject the clock, no sleeps); target ≥90% coverage on `src/business` and `src/repositories`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

Project setup:
- Use it *before* grep/Read to find where things live and what a change affects: `graphify affected "<symbol>"` lists impacted nodes before refactors.
- Built with `graphify extract . --code-only` then `graphify cluster-only . --no-label` (local AST, no LLM or API key). Scope in `.graphifyignore`.
- `graph.json`, `GRAPH_REPORT.md`, `graph.html` are committed; cache files are ignored. Git hooks (`graphify hook install`) refresh the graph on commit/checkout.
- `.claude/settings.json` hooks remind the agent to query the graph before searching; they are advisory and need the `graphify` CLI (`uv tool install graphifyy`).
- Include this rule in every subagent prompt that explores code.
