# Graph Report - Gamer Arena  (2026-10-20)

## Corpus Check
- 46 files · ~17,551 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 323 nodes · 708 edges · 23 communities (11 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `834736a5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- InMemoryRepository
- world.ts
- page.tsx
- validation.ts
- TournamentService
- bracket.ts
- implementations.ts
- DrizzleRepository
- TeamMemberRepository
- UserRepository
- IRepository
- layout.tsx
- TeamService
- MatchService
- TournamentRepository
- TournamentTeamRepository
- AnnouncementRepository
- MatchRepository
- MatchResultRepository
- GamerArena
- GamerArena
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `Repositories` - 22 edges
2. `IRepository` - 20 edges
3. `DrizzleRepository` - 19 edges
4. `InMemoryRepository` - 18 edges
5. `TournamentService` - 16 edges
6. `Clock` - 12 edges
7. `Services` - 11 edges
8. `TeamService` - 11 edges
9. `DomainError` - 10 edges
10. `MatchService` - 10 edges

## Surprising Connections (you probably didn't know these)
- `expectCrud()` --indirect_call--> `EntityNotFoundError`  [INFERRED]
  tests/repositories/crud.test.ts → src/repositories/repository.ts
- `Arena` --references--> `Services`  [EXTRACTED]
  tests/helpers/world.ts → src/business/index.ts
- `Arena` --references--> `Repositories`  [EXTRACTED]
  tests/helpers/world.ts → src/repositories/interfaces.ts
- `InMemoryRepository` --implements--> `IRepository`  [EXTRACTED]
  tests/helpers/fakes.ts → src/repositories/repository.ts
- `seedDatabase()` --calls--> `createServices()`  [EXTRACTED]
  scripts/seed-data.ts → src/business/index.ts

## Import Cycles
- None detected.

## Communities (23 total, 12 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.09
Nodes (21): BracketService, BracketDto, BracketMatchDto, BracketRoundDto, Eligibility, TeamRefDto, Clock, DomainError (+13 more)

### Community 1 - "InMemoryRepository"
Cohesion: 0.07
Nodes (10): FakeAnnouncements, FakeMatches, FakeMatchResults, FakeTeamMembers, FakeTeams, FakeTournaments, FakeTournamentTeams, FakeUsers (+2 more)

### Community 2 - "world.ts"
Cohesion: 0.13
Nodes (26): PLAYERS, seedDatabase(), main(), createServices(), derive(), hashPassword(), verifyPassword(), RegistrationContext (+18 more)

### Community 3 - "page.tsx"
Cohesion: 0.16
Nodes (13): LiveBracket(), Tournaments(), Bracket(), SiteHeader(), STATUS, StatusBadge(), ThemeToggle(), TournamentTable() (+5 more)

### Community 4 - "validation.ts"
Cohesion: 0.21
Nodes (19): FieldErrors, isNonNegativeInteger(), isNonNegativeNumber(), isPositiveInteger(), isValidDate(), isValidEmail(), isValidGamerTag(), isValidPassword() (+11 more)

### Community 6 - "bracket.ts"
Cohesion: 0.26
Nodes (7): generateBracket(), nextPowerOfTwo(), PlannedMatch, roundLabel(), seedOrder(), TeamRepository, teams()

### Community 7 - "implementations.ts"
Cohesion: 0.29
Nodes (4): GameRepository, SqliteUnitOfWork, IGameRepository, IUnitOfWork

### Community 8 - "DrizzleRepository"
Cohesion: 0.20
Nodes (3): DrizzleRepository, IdTable, Row

### Community 12 - "layout.tsx"
Cohesion: 0.29
Nodes (5): bricolage, geistMono, geistSans, metadata, ThemeProvider()

### Community 20 - "GamerArena"
Cohesion: 0.25
Nodes (7): Aim and purpose, Caveats, GamerArena, Links, Project layout, Run it, Stack

### Community 21 - "GamerArena"
Cohesion: 0.29
Nodes (6): Architecture, Commands, Design system, GamerArena, graphify, Testing

## Knowledge Gaps
- **33 isolated node(s):** `PLAYERS`, `geistSans`, `geistMono`, `bricolage`, `metadata` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IRepository` connect `IRepository` to `InMemoryRepository`, `world.ts`, `implementations.ts`, `DrizzleRepository`, `TeamMemberRepository`, `UserRepository`, `TournamentRepository`, `TournamentTeamRepository`, `AnnouncementRepository`, `MatchRepository`, `MatchResultRepository`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `Repositories` connect `index.ts` to `world.ts`, `implementations.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `InMemoryRepository` connect `InMemoryRepository` to `world.ts`, `IRepository`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `PLAYERS`, `geistSans`, `geistMono` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09176470588235294 - nodes in this community are weakly interconnected._
- **Should `InMemoryRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1331923890063425 - nodes in this community are weakly interconnected._