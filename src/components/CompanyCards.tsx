import { Link } from "@tanstack/react-router";
import { COMPANIES, type Goal } from "@/lib/goals";

export function CompanyCards({ goals, linkable = true }: { goals: Goal[]; linkable?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COMPANIES.map((c) => {
        const cg = goals.filter((g) => g.company === c.id);
        const done = cg.filter((g) => g.done).length;
        const inner = (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold" style={{ color: c.color }}>
                {c.name}
              </h2>
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all" style={{ width: `${(cg.length ? done / cg.length : 0) * 100}%`, backgroundColor: c.color }} />
            </div>
            <p className="mt-3 text-muted-foreground">
              <span className="font-semibold text-foreground">{done}/{cg.length}</span> metas completadas
            </p>
          </>
        );
        const cls = "block rounded-3xl bg-card p-6 shadow-soft transition-transform active:scale-[0.99]";
        return linkable ? (
          <Link key={c.id} to="/c/$company" params={{ company: c.id }} className={cls} style={{ borderTop: `6px solid ${c.color}` }}>
            {inner}
          </Link>
        ) : (
          <div key={c.id} className={cls} style={{ borderTop: `6px solid ${c.color}` }}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

