import { beforeEach, describe, expect, it } from "vitest";
import { createServices, type Services } from "@/business";
import { hashPassword, verifyPassword } from "@/business/password";
import type { Repositories } from "@/repositories";
import { createFakeRepositories } from "../helpers/fakes";
import { NOW, makeUser } from "../helpers/world";

let repos: Repositories;
let services: Services;
beforeEach(() => {
  repos = createFakeRepositories();
  services = createServices(repos, () => NOW);
});

const signup = { userName: "jane", email: "Jane@Example.com", password: "Sup3rSecret", gamerTag: "JaneDoe" };

describe("password hashing", () => {
  it("round-trips and uses a fresh salt each time", async () => {
    const a = await hashPassword("Sup3rSecret");
    const b = await hashPassword("Sup3rSecret");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Sup3rSecret", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("UserService", () => {
  it("registers a player with a lower-cased email and a hashed password", async () => {
    const user = await services.users.register(signup);
    expect(user).toMatchObject({ email: "jane@example.com", role: "player", gamerTag: "JaneDoe" });
    expect(user.passwordHash).not.toContain("Sup3rSecret");
  });

  it("returns every validation error", async () => {
    await expect(
      services.users.register({ userName: "j", email: "bad", password: "x", gamerTag: "" }),
    ).rejects.toMatchObject({ code: "validation", fields: { userName: expect.any(String), email: expect.any(String) } });
  });

  it("detects duplicate email, username and gamer tag together", async () => {
    await services.users.register(signup);
    await expect(services.users.register({ ...signup, email: "JANE@example.com" })).rejects.toMatchObject({
      code: "conflict",
      fields: { email: expect.any(String), userName: expect.any(String), gamerTag: expect.any(String) },
    });
  });

  it("only admins change roles and cannot demote themselves", async () => {
    const admin = await makeUser(repos, "admin");
    const player = await makeUser(repos);
    await expect(services.users.changeRole(player.id, player.id, "admin")).rejects.toMatchObject({ code: "forbidden" });
    await expect(services.users.changeRole(admin.id, player.id, "organizer")).resolves.toMatchObject({ role: "organizer" });
    await expect(services.users.changeRole(admin.id, admin.id, "player")).rejects.toMatchObject({ code: "conflict" });
    await expect(services.users.getById(404)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("GameService", () => {
  it("admins add games; names are unique case-insensitively", async () => {
    const admin = await makeUser(repos, "admin");
    const player = await makeUser(repos);
    await expect(services.games.createGame(player.id, { name: "Chess", genre: "Board", teamSize: 1 })).rejects.toMatchObject({ code: "forbidden" });
    await services.games.createGame(admin.id, { name: "Chess", genre: "Board", teamSize: 1 });
    await expect(services.games.createGame(admin.id, { name: " chess ", genre: "Board", teamSize: 1 })).rejects.toMatchObject({ code: "conflict" });
    await expect(services.games.createGame(admin.id, { name: "Go", genre: "Board", teamSize: 0 })).rejects.toMatchObject({ code: "validation" });
    expect(await services.games.list()).toHaveLength(1);
  });
});

describe("TeamService", () => {
  it("creating a team makes the captain an accepted member", async () => {
    const captain = await makeUser(repos);
    const team = await services.teams.createTeam(captain.id, "  Wolves ");
    expect(team).toMatchObject({ name: "Wolves", captainId: captain.id, isSoloEntry: false });
    expect(await services.teams.getAcceptedMembers(team.id)).toHaveLength(1);
  });

  it("rejects bad or duplicate names and unknown captains", async () => {
    const captain = await makeUser(repos);
    await expect(services.teams.createTeam(captain.id, "x")).rejects.toMatchObject({ code: "validation" });
    await services.teams.createTeam(captain.id, "Wolves");
    await expect(services.teams.createTeam(captain.id, "Wolves")).rejects.toMatchObject({ code: "conflict" });
    await expect(services.teams.createTeam(404, "Ghosts")).rejects.toMatchObject({ code: "not_found" });
  });

  it("solo team is named after the gamer tag and is reused", async () => {
    const player = await makeUser(repos, "player", "SoloKing");
    const first = await services.teams.getOrCreateSoloTeam(player.id);
    const again = await services.teams.getOrCreateSoloTeam(player.id);
    expect(first).toMatchObject({ name: "SoloKing", isSoloEntry: true });
    expect(again.id).toBe(first.id);
    await expect(services.teams.invite(player.id, first.id, (await makeUser(repos)).id)).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("invite -> accept / decline -> re-invite flow", async () => {
    const captain = await makeUser(repos);
    const friend = await makeUser(repos);
    const team = await services.teams.createTeam(captain.id, "Wolves");

    const invite = await services.teams.invite(captain.id, team.id, friend.id);
    expect(invite.invitationStatus).toBe("pending");
    await expect(services.teams.invite(captain.id, team.id, friend.id)).rejects.toMatchObject({ code: "conflict" });

    const declined = await services.teams.respondToInvitation(friend.id, team.id, false);
    expect(declined).toMatchObject({ invitationStatus: "declined", joinedOn: null });
    await expect(services.teams.respondToInvitation(friend.id, team.id, true)).rejects.toMatchObject({ code: "not_found" });

    await services.teams.invite(captain.id, team.id, friend.id); // allowed again after decline
    const accepted = await services.teams.respondToInvitation(friend.id, team.id, true);
    expect(accepted).toMatchObject({ invitationStatus: "accepted", joinedOn: NOW });
    await expect(services.teams.invite(captain.id, team.id, friend.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("only the captain invites, and only existing users", async () => {
    const captain = await makeUser(repos);
    const other = await makeUser(repos);
    const team = await services.teams.createTeam(captain.id, "Wolves");
    await expect(services.teams.invite(other.id, team.id, other.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(services.teams.invite(captain.id, team.id, 404)).rejects.toMatchObject({ code: "not_found" });
    await expect(services.teams.invite(captain.id, 404, other.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
