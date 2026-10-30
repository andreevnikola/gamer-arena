# Graph Report - Gamer Arena  (2026-10-30)

## Corpus Check
- 47 files · ~24,657 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 334 nodes · 744 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b86e80e`
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
- IRepository
- layout.tsx
- TeamService
- MatchService
- TournamentRepository
- TournamentTeamRepository
- MatchResultRepository
- GamerArena
- GamerArena
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `Repositories` - 22 edges
2. `IRepository` - 20 edges
3. `DrizzleRepository` - 20 edges
4. `InMemoryRepository` - 18 edges
5. `TournamentService` - 16 edges
6. `DbContext` - 16 edges
7. `Clock` - 12 edges
8. `Services` - 11 edges
9. `TeamService` - 11 edges
10. `DomainError` - 10 edges

## Surprising Connections (you probably didn't know these)
- `expectCrud()` --indirect_call--> `EntityNotFoundError`  [INFERRED]
  tests/repositories/crud.test.ts → src/repositories/repository.ts
- `Arena` --references--> `Repositories`  [EXTRACTED]
  tests/helpers/world.ts → src/repositories/interfaces.ts
- `InMemoryRepository` --implements--> `IRepository`  [EXTRACTED]
  tests/helpers/fakes.ts → src/repositories/repository.ts
- `seedDatabase()` --calls--> `createServices()`  [EXTRACTED]
  scripts/seed-data.ts → src/business/index.ts
- `main()` --calls--> `createRepositories()`  [EXTRACTED]
  scripts/seed.ts → src/repositories/index.ts

## Import Cycles
- None detected.

## Communities (21 total, 7 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.10
Nodes (19): BracketService, BracketMatchDto, BracketRoundDto, Eligibility, TeamRefDto, Clock, DomainError, DomainErrorCode (+11 more)

### Community 1 - "InMemoryRepository"
Cohesion: 0.07
Nodes (10): FakeAnnouncements, FakeMatches, FakeMatchResults, FakeTeamMembers, FakeTeams, FakeTournaments, FakeTournamentTeams, FakeUsers (+2 more)

### Community 2 - "world.ts"
Cohesion: 0.12
Nodes (30): PLAYERS, seedDatabase(), main(), createServices(), Services, derive(), hashPassword(), verifyPassword() (+22 more)

### Community 3 - "page.tsx"
Cohesion: 0.13
Nodes (14): LiveBracket(), Tournaments(), BracketDto, Bracket(), SiteHeader(), STATUS, StatusBadge(), ThemeToggle() (+6 more)

### Community 4 - "validation.ts"
Cohesion: 0.21
Nodes (19): FieldErrors, isNonNegativeInteger(), isNonNegativeNumber(), isPositiveInteger(), isValidDate(), isValidEmail(), isValidGamerTag(), isValidPassword() (+11 more)

### Community 5 - "TournamentService"
Cohesion: 0.18
Nodes (7): generateBracket(), nextPowerOfTwo(), PlannedMatch, roundLabel(), seedOrder(), TournamentSummaryDto, TournamentService

### Community 6 - "bracket.ts"
Cohesion: 0.32
Nodes (3): TeamRepository, ITeamRepository, teams()

### Community 7 - "implementations.ts"
Cohesion: 0.23
Nodes (6): GameRepository, IAnnouncementRepository, IGameRepository, IMatchRepository, ITournamentRepository, IUnitOfWork

### Community 8 - "DrizzleRepository"
Cohesion: 0.17
Nodes (5): UserRepository, DrizzleRepository, first(), IdTable, Row

### Community 12 - "layout.tsx"
Cohesion: 0.29
Nodes (5): bricolage, geistMono, geistSans, metadata, ThemeProvider()

### Community 15 - "TournamentRepository"
Cohesion: 0.13
Nodes (5): AnnouncementRepository, MatchRepository, PostgresUnitOfWork, TournamentRepository, DbContext

### Community 20 - "GamerArena"
Cohesion: 0.25
Nodes (7): Aim and purpose, Caveats, GamerArena, Links, Project layout, Run it, Stack

### Community 21 - "GamerArena"
Cohesion: 0.29
Nodes (6): Architecture, Commands, Design system, GamerArena, graphify, Testing

## Knowledge Gaps
- **34 isolated node(s):** `PLAYERS`, `geistSans`, `geistMono`, `bricolage`, `metadata` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IRepository` connect `IRepository` to `InMemoryRepository`, `world.ts`, `bracket.ts`, `implementations.ts`, `DrizzleRepository`, `TeamMemberRepository`, `TournamentRepository`, `TournamentTeamRepository`, `MatchResultRepository`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `Repositories` connect `index.ts` to `world.ts`, `implementations.ts`, `TournamentRepository`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `InMemoryRepository` connect `InMemoryRepository` to `world.ts`, `IRepository`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `PLAYERS`, `geistSans`, `geistMono` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10144927536231885 - nodes in this community are weakly interconnected._
- **Should `InMemoryRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11748381128584644 - nodes in this community are weakly interconnected._