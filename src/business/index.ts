import type { Repositories } from "@/repositories";
import { BracketService } from "./bracket-service";
import type { Clock } from "./errors";
import { GameService } from "./game-service";
import { MatchService } from "./match-service";
import { RegistrationService } from "./registration-service";
import { TeamService } from "./team-service";
import { TournamentService } from "./tournament-service";
import { UserService } from "./user-service";

export * from "./dto";
export * from "./errors";
export { BracketService } from "./bracket-service";
export { GameService } from "./game-service";
export { MatchService, type ReportResultInput } from "./match-service";
export { RegistrationService, evaluateRegistration } from "./registration-service";
export { TeamService } from "./team-service";
export { TournamentService, canTransition, type CreateTournamentInput } from "./tournament-service";
export { UserService } from "./user-service";
export * as validation from "./validation";

export interface Services {
  users: UserService;
  games: GameService;
  teams: TeamService;
  tournaments: TournamentService;
  registrations: RegistrationService;
  matches: MatchService;
}

/** Wires services to repository interfaces. The only place services are constructed. */
export function createServices(repos: Repositories, now: Clock = () => new Date()): Services {
  const brackets = new BracketService(repos);
  return {
    users: new UserService(repos, now),
    games: new GameService(repos),
    teams: new TeamService(repos, now),
    tournaments: new TournamentService(repos, brackets, now),
    registrations: new RegistrationService(repos, now),
    matches: new MatchService(repos, now),
  };
}
