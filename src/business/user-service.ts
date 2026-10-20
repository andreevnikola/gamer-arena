import type { User, UserRole } from "@/data/types";
import type { Repositories } from "@/repositories";
import { DomainError, type Clock } from "./errors";
import { hashPassword } from "./password";
import { validateUserRegistration, type UserRegistrationInput } from "./validation";

export class UserService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: Clock,
  ) {}

  async register(input: UserRegistrationInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const normalized = {
      ...input,
      email,
      userName: input.userName.trim(),
      gamerTag: input.gamerTag.trim(),
    };
    const validation = validateUserRegistration(normalized);
    if (!validation.valid) {
      throw new DomainError("validation", "Registration data is invalid.", validation.errors);
    }

    const [byEmail, byName, byTag] = await Promise.all([
      this.repos.users.getByEmail(email),
      this.repos.users.getByUserName(normalized.userName),
      this.repos.users.getByGamerTag(normalized.gamerTag),
    ]);
    const taken: Record<string, string> = {};
    if (byEmail) taken.email = "Email is already registered.";
    if (byName) taken.userName = "Username is taken.";
    if (byTag) taken.gamerTag = "Gamer tag is taken.";
    if (Object.keys(taken).length > 0) throw new DomainError("conflict", "Account already exists.", taken);

    return this.repos.users.add({
      userName: normalized.userName,
      email,
      gamerTag: normalized.gamerTag,
      passwordHash: await hashPassword(input.password),
      role: "player",
      registeredOn: this.now(),
    });
  }

  async getById(id: number): Promise<User> {
    const user = await this.repos.users.getById(id);
    if (!user) throw new DomainError("not_found", `User ${id} not found.`);
    return user;
  }

  /** Only admins may change roles; admins cannot demote themselves (prevents lock-out). */
  async changeRole(actorId: number, userId: number, role: UserRole): Promise<User> {
    const actor = await this.getById(actorId);
    if (actor.role !== "admin") throw new DomainError("forbidden", "Only admins can change roles.");
    if (actorId === userId && role !== "admin") {
      throw new DomainError("conflict", "Admins cannot demote themselves.");
    }
    const user = await this.getById(userId);
    return this.repos.users.update({ ...user, role });
  }
}
