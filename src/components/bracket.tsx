import type { BracketDto, BracketMatchDto, TeamRefDto } from "@/business";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 6.5; // rem per first-round slot
const COLUMN_WIDTH = "14rem";

function TeamRow({
  team,
  score,
  isWinner,
  decided,
  isBye,
}: {
  team: TeamRefDto | null;
  score: number | null;
  isWinner: boolean;
  decided: boolean;
  isBye: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-l-2 border-transparent px-3 py-2 text-sm",
        isWinner && "border-primary bg-accent font-semibold text-accent-foreground",
        decided && !isWinner && "text-muted-foreground",
      )}
    >
      <span className={cn("truncate", !team && "text-muted-foreground")}>
        {team ? team.name : isBye ? "Bye" : "To be decided"}
      </span>
      <span className="tabular-nums">{score ?? ""}</span>
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatchDto }) {
  const decided = match.status === "completed";
  const isBye = decided && (match.teamA === null || match.teamB === null);
  return (
    <Card size="sm" className="w-full gap-0 py-0">
      <TeamRow
        team={match.teamA}
        score={match.scoreA}
        isWinner={decided && match.winnerTeamId === match.teamA?.id}
        decided={decided}
        isBye={isBye}
      />
      <div className="border-t" />
      <TeamRow
        team={match.teamB}
        score={match.scoreB}
        isWinner={decided && match.winnerTeamId === match.teamB?.id}
        decided={decided}
        isBye={isBye}
      />
      {match.status === "disputed" && (
        <div className="border-t px-3 py-1.5">
          <Badge variant="destructive">Scores disagree</Badge>
        </div>
      )}
    </Card>
  );
}

/**
 * Single-elimination bracket. A CSS grid gives every round a column; a match
 * in round r spans 2^(r-1) rows so it sits centred between the two matches
 * that feed it. Connector lines are drawn with borders on each cell.
 */
export function Bracket({ bracket }: { bracket: BracketDto }) {
  const totalRounds = bracket.rounds.length;
  const rows = bracket.rounds[0]?.matches.length ?? 0;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid min-w-max gap-x-12"
        style={{
          gridTemplateColumns: `repeat(${totalRounds}, ${COLUMN_WIDTH})`,
          gridTemplateRows: `auto repeat(${rows}, ${ROW_HEIGHT}rem)`,
        }}
      >
        {bracket.rounds.map((round) => (
          <h3
            key={`label-${round.round}`}
            className="pb-3 text-sm font-medium text-muted-foreground"
            style={{ gridColumn: round.round, gridRow: 1 }}
          >
            {round.label}
          </h3>
        ))}
        {bracket.rounds.flatMap((round) =>
          round.matches.map((match, index) => {
            const span = 2 ** (round.round - 1);
            const hasNext = round.round < totalRounds;
            return (
              <div
                key={match.id}
                className="relative flex items-center"
                style={{
                  gridColumn: round.round,
                  gridRow: `${index * span + 2} / span ${span}`,
                }}
              >
                {round.round > 1 && (
                  <span aria-hidden className="absolute top-1/2 -left-6 w-6 border-t border-border" />
                )}
                <MatchCard match={match} />
                {hasNext && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -right-6 w-6 border-r border-border",
                      index % 2 === 0
                        ? "top-1/2 h-1/2 rounded-tr-md border-t"
                        : "bottom-1/2 h-1/2 rounded-br-md border-b",
                    )}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
