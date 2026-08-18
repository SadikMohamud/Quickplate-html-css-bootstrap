import { stampLetters, theme } from "@/lib/theme";
import type { CardMilestone } from "@/lib/types";

interface StampCardProps {
  earned: number;
  total: number;
  // Milestones on the active rule, used to mark the reward cells and
  // label them underneath their row.
  milestones?: CardMilestone[];
  // When true, the stamp just earned pops in. Used at the till.
  animateLast?: boolean;
}

// The rows of the card face. Normally the letters from the theme, one per
// stamp, exactly as the paper card is printed. If the owner changes the
// card size so the letters no longer fit, fall back to numbered cells in
// rows of five rather than showing a card that does not add up.
function cellRows(total: number): string[][] {
  if (stampLetters.length === total) {
    return theme.stampCard.rows.map((row) => row.split(""));
  }
  const rows: string[][] = [];
  for (let i = 0; i < total; i += 5) {
    rows.push(
      Array.from({ length: Math.min(5, total - i) }, (_, n) => String(i + n + 1))
    );
  }
  return rows;
}

const GAP_REM = 0.5;

export default function StampCard({
  earned,
  total,
  milestones = [],
  animateLast = false,
}: StampCardProps) {
  if (total <= 0) return null;

  const rows = cellRows(total);
  const widest = Math.max(...rows.map((row) => row.length));
  // Every cell is the same size in both rows, sized from the longest row
  // so the shorter row centres above it instead of growing.
  const cellWidth = `calc((100% - ${
    (widest - 1) * GAP_REM
  }rem) / ${widest})`;

  // Where each row starts in the run of stamps, worked out up front so
  // nothing is mutated while rendering.
  const rowStarts = rows.reduce<number[]>(
    (acc, row, i) => [...acc, acc[i] + row.length],
    [0]
  );

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIndex) => {
        const rowStart = rowStarts[rowIndex];
        const rowEnd = rowStart + row.length;
        const rowMilestones = milestones.filter(
          (m) => m.stamps_required > rowStart && m.stamps_required <= rowEnd
        );

        return (
          <div key={rowIndex} className="flex flex-col gap-1.5">
            <div
              className="flex justify-center"
              style={{ gap: `${GAP_REM}rem` }}
            >
              {row.map((label, i) => {
                const index = rowStart + i;
                const filled = index < earned;
                const isLast = filled && index === earned - 1;
                const isMilestone = milestones.some(
                  (m) => m.stamps_required === index + 1
                );

                return (
                  <div
                    key={index}
                    style={{ width: cellWidth }}
                    aria-label={
                      filled ? "Stamp earned" : "Stamp not yet earned"
                    }
                    className={`flex aspect-square items-center justify-center rounded-full text-lg font-semibold uppercase transition-colors duration-300 ${
                      filled
                        ? `border-2 border-brand bg-brand/10 text-brand ${
                            isLast && animateLast ? "animate-stamp-pop" : ""
                          }`
                        : "border border-dashed border-brand/25 text-brand/25"
                    } ${isMilestone ? "ring-2 ring-brand/30 ring-offset-2 ring-offset-brand-surface" : ""}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {rowMilestones.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-1.5">
                {rowMilestones.map((m) => (
                  <li
                    key={m.milestone_id}
                    className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
                      m.redeemed
                        ? "bg-brand-muted/15 text-brand-muted line-through"
                        : m.earned
                          ? "bg-brand-success/15 text-brand-success"
                          : "bg-brand/8 text-brand-muted"
                    }`}
                  >
                    {m.stamps_required} stamps &middot; {m.reward_label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
