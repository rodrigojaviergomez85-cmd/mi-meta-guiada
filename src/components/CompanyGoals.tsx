import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GoalRow } from "./GoalRow";
import { LEVELS, companyInfo, goalsFor, levelTitle, type Company, type SnapshotData, type Goal } from "@/lib/goals";
import type { GoalPatch } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function CompanyGoals({
  data,
  company,
  readOnly,
  onPatch,
  showTitle,
}: {
  data: SnapshotData;
  company: Company;
  readOnly?: boolean;
  onPatch: (goal: Goal, patch: GoalPatch) => void;
  showTitle?: boolean;
}) {
  const info = companyInfo(company)!;
  const [open, setOpen] = useState<Record<string, boolean>>({ annual: true, monthly: true, weekly: true });

  return (
    <div className="space-y-4">
      {showTitle && (
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: info.color }} />
          {info.name}
        </h2>
      )}
      {LEVELS.map((level) => {
        const goals = goalsFor(data.goals, company, level);
        const done = goals.filter((g) => g.done).length;
        return (
          <section key={level} className="overflow-hidden rounded-2xl bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [level]: !o[level] }))}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
              style={{ borderLeft: `4px solid ${info.color}` }}
            >
              <span className="min-w-0 flex-1 font-display text-base font-semibold">
                {levelTitle(level, data.snapshot)}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">{done}/5</span>
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", !open[level] && "-rotate-90")}
              />
            </button>
            {open[level] && (
              <ul className="divide-y divide-border px-3 pb-2">
                {goals.map((g) => (
                  <GoalRow key={g.id} goal={g} color={info.color} readOnly={readOnly} onPatch={onPatch} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
