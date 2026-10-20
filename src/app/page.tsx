import { Suspense } from "react";
import { connection } from "next/server";
import { Bracket } from "@/components/bracket";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentTable } from "@/components/tournament-table";
import { getServices } from "@/composition";
import { formatPrize } from "@/lib/format";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pt-10 pb-20 sm:px-6">
        <section className="max-w-2xl">
          <h1 className="text-4xl font-semibold sm:text-6xl">Brackets that run themselves.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            GamerArena registers teams, seeds the bracket and confirms every score from both sides, so organizers can
            get back to the games.
          </p>
        </section>

        <Suspense fallback={<LiveBracketSkeleton />}>
          <LiveBracket />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Tournaments />
        </Suspense>

        <Separator />
        <p className="max-w-xl text-sm text-muted-foreground">
          Sprint 1 delivers the data and business layers. Sign-in, registration forms and organizer tools arrive next.
        </p>
      </main>
    </>
  );
}

async function LiveBracket() {
  await connection(); // read the database per request, never at build time
  const { tournaments } = getServices();
  const all = await tournaments.list();
  const featured = all.find((t) => t.status === "in_progress") ?? all.find((t) => t.status === "completed");

  if (!featured) {
    return (
      <Card className="max-w-xl px-6">
        <p className="font-heading text-base font-medium">No bracket to show yet</p>
        <p className="text-muted-foreground">
          Load the demo tournaments with <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">npm run db:seed</code>.
        </p>
      </Card>
    );
  }

  const bracket = await tournaments.getBracket(featured.id);
  return (
    <section className="flex flex-col gap-6" aria-labelledby="live-bracket">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="live-bracket" className="text-2xl font-semibold">
          {featured.title}
        </h2>
        <StatusBadge status={featured.status} />
        <p className="w-full text-muted-foreground">
          {featured.gameName}, {featured.approvedTeams} teams, prize {formatPrize(featured.prizePool)}
        </p>
      </div>
      <Bracket bracket={bracket} />
    </section>
  );
}

async function Tournaments() {
  await connection();
  const list = await getServices().tournaments.list();
  return (
    <section className="flex flex-col gap-4" aria-labelledby="all-tournaments">
      <h2 id="all-tournaments" className="text-2xl font-semibold">
        All tournaments
      </h2>
      {list.length === 0 ? (
        <p className="text-muted-foreground">No tournaments yet.</p>
      ) : (
        <TournamentTable tournaments={list} />
      )}
    </section>
  );
}

function LiveBracketSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
