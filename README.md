# GamerArena

Platform for gaming events and tournaments. School project at МГ „Академик Кирил Попов“ (team: Никола, Онур, Стефан).

## Links

- Deployed app: [GamerArena](https://gamer-arena-cyan.vercel.app/)
- Trello board: [GamerArena - Sprint 1](https://trello.com/b/DU88DdpV/gamerarena-sprint-1)
- Design document (source of truth, Google Docs): [GamerArena Design ERD Architecture](https://docs.google.com/document/d/1eb1UVWwo2hGeQ7F6HJQQjH6Cy3m7HLGncpQ07OcbalY/edit)

## Aim and purpose

Organizers create tournaments, teams (or solo players) register, brackets are generated automatically and results advance winners round by round.

This repository holds **Sprint 1 only: Git, Trello, Data and Business layers**:

- 9 entities (Drizzle schema, Postgres) with migrations and demo data
- Repository layer: generic `IRepository<T>` CRUD plus entity-specific repositories and a unit of work
- Business layer: bracket generation (the "calculator" service), registration access check, validation, role checks, match results and disputes
- A single showcase page (live bracket + tournament list) that proves the layers connect
- 174 tests, about 95% coverage

Not in Sprint 1: login/sessions, forms, team and registration screens, deployment.

## Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Drizzle ORM + PostgreSQL (Neon, `pg`), shadcn/ui + Tailwind CSS 4, Vitest, ESLint.

## Run it

Requirements: Node.js 20.9+ (developed on 24), npm, and a PostgreSQL database (Neon).

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL (direct) and DATABASE_URL_POOLED
npm run setup          # applies migrations, loads demo data
npm run dev       # http://localhost:3000
```

Other commands:

```bash
npm test               # all tests (in-process Postgres via PGlite, never touches Neon)
npm run test:coverage  # coverage report
npm run typecheck
npm run lint           # also enforces the layer boundaries
npm run build && npm start
npm run db:reset       # DROP all tables in the database from .env, migrate and re-seed
npm run db:generate    # after editing src/data/schema.ts: generate a new migration
```

## Caveats

- **The database is Neon Postgres**, configured in `.env` (not committed; see `.env.example`). The app uses `DATABASE_URL_POOLED`; migrations and scripts use the direct `DATABASE_URL`. Migrations are not applied at app start: run `npm run db:migrate`. `npm run db:reset` is destructive, so never point it at data you care about.
- **No login yet.** Roles are a `users.role` column (player, organizer, admin) checked in the business layer. Seeded users share the demo password `Password1`; it is only meaningful once authentication exists.
- **Pages read the database at request time** (Next.js Cache Components: `await connection()` inside `<Suspense>`). Keep that pattern for new pages or the data freezes at build time.
- **`npm install` prints audit and script-approval warnings** from dev tooling. They do not affect the app.
- **Unit of work:** inside `unitOfWork.run(...)` only await repository calls (the transaction and a serialising advisory lock are held for the whole callback).
- **Graphify** (code exploration, optional): `uv tool install graphifyy`, then see the Graphify section in `CLAUDE.md`. The graph lives in `graphify-out/`.
- **ERD diagram** is in `docs/erd.png` (SVG alongside); the Google Doc references it.

## Project layout

```
src/data          Drizzle schema, migrations runner, db factory
src/repositories  IRepository<T>, DrizzleRepository<T>, specific repos, unit of work
src/business      services, bracket, validation, DTOs, DomainError
src/composition.ts  wires layers together (only place that knows all of them)
src/app, src/components  Next.js UI (shadcn/ui in components/ui)
scripts/          seed data
tests/            business, repositories, integration, helpers
docs/             ERD diagram
```

Layers depend downward only (Presentation → Business → Repositories → Data); ESLint fails the build on violations. Design system, architecture decisions and testing policy are in `CLAUDE.md`.
