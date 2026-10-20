import type { TournamentSummaryDto } from "@/business";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPrize } from "@/lib/format";

export function TournamentTable({ tournaments }: { tournaments: TournamentSummaryDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tournament</TableHead>
          <TableHead>Game</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Teams</TableHead>
          <TableHead className="text-right">Prize</TableHead>
          <TableHead className="text-right">Starts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tournaments.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.title}</TableCell>
            <TableCell className="text-muted-foreground">{t.gameName}</TableCell>
            <TableCell>
              <StatusBadge status={t.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {t.approvedTeams} / {t.maxParticipants}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatPrize(t.prizePool)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatDate(t.startDate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
