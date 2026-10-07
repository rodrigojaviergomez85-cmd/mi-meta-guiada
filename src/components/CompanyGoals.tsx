import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCommentCounts } from "@/lib/people";
import { GoalRow } from "./GoalRow";
import { LEVELS, companyInfo, goalsFor, levelTitle, type Company, type SnapshotData, type Goal, type Level } from "@/lib/goals";
import type { GoalPatch } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function CompanyGoals({
  data,
  company,
  readOnly,
  onPatch,
  showTitle,
  assigneeFilter = "all",
  annualAside,
  annualAsideBeside = true,
}: {
  data: SnapshotData;
  company: Company;
  readOnly?: boolean;
  onPatch: (goal: Goal, patch: GoalPatch) => void;
  showTitle?: boolean;
  assigneeFilter?: string;
  annualAside?: ReactNode;
  annualAsideBeside?: boolean;
}) {
  const info = companyInfo(company)!;
  const qc = useQueryClient();
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const sid = data.snapshot.id;
  const { data: counts = {} } = useCommentCounts(sid);
  const update = (fn: (goals: Goal[]) => Goal[]) =>
    qc.setQueriesData<unknown>({}, (old: unknown) => {
      const o = old as SnapshotData | null | undefined;
      return o && typeof o === "object" && "snapshot" in o && o.snapshot?.id === sid ? { ...o, goals: fn(o.goals) } : old;
    });

  const addGoal = async (level: Level) => {
    const { data: row, error } = await supabase.rpc("add_goal", { _snapshot_id: sid, _company: company, _level: level });
    if (error || !row) {
      toast.error("No se pudo agregar la meta");
      return;
    }
    const g = row as Goal;
    update((goals) => [...goals, g]);
    setAutoEditId(g.id);
  };

  const deleteGoal = async (goal: Goal) => {
    update((goals) =>
      goals
        .filter((x) => x.id !== goal.id)
        .map((x) =>
          x.company === goal.company && x.level === goal.level && x.position > goal.position
            ? { ...x, position: x.position - 1 }
            : x,
        ),
    );
    const { error } = await supabase.rpc("delete_goal", { _id: goal.id });
    if (error) toast.error("No se pudo borrar la meta");
    void qc.invalidateQueries();
  };

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
        const section = (
          <section className="overflow-hidden rounded-2xl bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [level]: !o[level] }))}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
              style={{ borderLeft: `4px solid ${info.color}` }}
            >
              <span className="min-w-0 flex-1 font-display text-base font-semibold">
                {levelTitle(level, data.snapshot)}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">{done}/{goals.length}</span>
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", !open[level] && "-rotate-90")}
              />
            </button>
            {open[level] && (
              <ul className="divide-y divide-border px-3 pb-2">
                {goals
                  .filter((g) => assigneeFilter === "all" || (assigneeFilter === "none" ? !g.assignee_id : g.assignee_id === assigneeFilter))
                  .map((g) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    color={info.color}
                    readOnly={readOnly}
                    onPatch={onPatch}
                    autoEdit={g.id === autoEditId}
                    commentCount={counts[g.id] ?? 0}
                    onDelete={!readOnly && goals.length > 1 ? () => void deleteGoal(g) : undefined}
                  />
                ))}
              </ul>
            )}
            {open[level] && !readOnly && (
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => void addGoal(level)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" /> Agregar meta
                </button>
              </div>
            )}
          </section>
        );
        return (
          <Fragment key={level}>
            {level === "annual" && annualAside ? (
              <div className={cn("grid items-start gap-4", annualAsideBeside && "lg:grid-cols-2")}>
                {section}
                {annualAside}
              </div>
            ) : section}
          </Fragment>
        );
      })}
    </div>
  );
}
