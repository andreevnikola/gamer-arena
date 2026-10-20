import type { Team, TeamMember } from "@/data/types";
import type { Repositories } from "@/repositories";
import { DomainError, type Clock } from "./errors";
import { validateTeamName } from "./validation";

export class TeamService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: Clock,
  ) {}

  /** The captain joins their own team as an accepted member. */
  async createTeam(captainId: number, name: string): Promise<Team> {
    const trimmed = name.trim();
    const validation = validateTeamName(trimmed);
    if (!validation.valid) throw new DomainError("validation", "Team name is invalid.", validation.errors);
    return this.createTeamRecord(captainId, trimmed, false);
  }

  /** A 1v1 entrant is modelled as a team of one named after their gamer tag. Reuses an existing one. */
  async getOrCreateSoloTeam(userId: number): Promise<Team> {
    const user = await this.repos.users.getById(userId);
    if (!user) throw new DomainError("not_found", `User ${userId} not found.`);
    const existing = (await this.repos.teams.getByCaptain(userId)).find((t) => t.isSoloEntry);
    if (existing) return existing;
    return this.createTeamRecord(userId, user.gamerTag, true);
  }

  async invite(captainId: number, teamId: number, userId: number): Promise<TeamMember> {
    const team = await this.requireCaptainTeam(captainId, teamId);
    if (team.isSoloEntry) throw new DomainError("invalid_state", "Solo entries cannot invite members.");
    if (!(await this.repos.users.getById(userId))) {
      throw new DomainError("not_found", `User ${userId} not found.`);
    }
    const existing = await this.repos.teamMembers.getByTeamAndUser(teamId, userId);
    if (existing?.invitationStatus === "accepted") {
      throw new DomainError("conflict", "User is already on the team.");
    }
    if (existing?.invitationStatus === "pending") {
      throw new DomainError("conflict", "An invitation is already pending.");
    }
    if (existing) return this.repos.teamMembers.update({ ...existing, invitationStatus: "pending", joinedOn: null });
    return this.repos.teamMembers.add({ teamId, userId, invitationStatus: "pending" });
  }

  async respondToInvitation(userId: number, teamId: number, accept: boolean): Promise<TeamMember> {
    const member = await this.repos.teamMembers.getByTeamAndUser(teamId, userId);
    if (!member || member.invitationStatus !== "pending") {
      throw new DomainError("not_found", "No pending invitation found.");
    }
    return this.repos.teamMembers.update({
      ...member,
      invitationStatus: accept ? "accepted" : "declined",
      joinedOn: accept ? this.now() : null,
    });
  }

  async getAcceptedMembers(teamId: number): Promise<TeamMember[]> {
    const members = await this.repos.teamMembers.getByTeam(teamId);
    return members.filter((m) => m.invitationStatus === "accepted");
  }

  private async createTeamRecord(captainId: number, name: string, isSoloEntry: boolean): Promise<Team> {
    if (!(await this.repos.users.getById(captainId))) {
      throw new DomainError("not_found", `User ${captainId} not found.`);
    }
    if (await this.repos.teams.getByName(name)) {
      throw new DomainError("conflict", "Team name is taken.", { name: "Team name is taken." });
    }
    return this.repos.unitOfWork.run(async () => {
      const team = await this.repos.teams.add({ name, captainId, isSoloEntry, createdOn: this.now() });
      await this.repos.teamMembers.add({
        teamId: team.id,
        userId: captainId,
        invitationStatus: "accepted",
        joinedOn: this.now(),
      });
      return team;
    });
  }

  private async requireCaptainTeam(captainId: number, teamId: number): Promise<Team> {
    const team = await this.repos.teams.getById(teamId);
    if (!team) throw new DomainError("not_found", `Team ${teamId} not found.`);
    if (team.captainId !== captainId) throw new DomainError("forbidden", "Only the captain can do this.");
    return team;
  }
}
