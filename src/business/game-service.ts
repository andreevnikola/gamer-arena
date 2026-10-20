import type { Game } from "@/data/types";
import type { Repositories } from "@/repositories";
import { DomainError } from "./errors";
import { validateGame } from "./validation";

export class GameService {
  constructor(private readonly repos: Repositories) {}

  async createGame(actorId: number, input: { name: string; genre: string; teamSize: number }): Promise<Game> {
    const actor = await this.repos.users.getById(actorId);
    if (actor?.role !== "admin") throw new DomainError("forbidden", "Only admins can add games.");
    const validation = validateGame(input);
    if (!validation.valid) throw new DomainError("validation", "Game data is invalid.", validation.errors);
    const games = await this.repos.games.getAll();
    if (games.some((g) => g.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new DomainError("conflict", "A game with this name already exists.", { name: "Name is taken." });
    }
    return this.repos.games.add({ name: input.name.trim(), genre: input.genre.trim(), teamSize: input.teamSize });
  }

  list(): Promise<Game[]> {
    return this.repos.games.getAll();
  }
}
