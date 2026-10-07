import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Columns3 } from "lucide-react";
import { CompanyGoals } from "@/components/CompanyGoals";
import { CompanyIssues } from "@/components/CompanyIssues";
import { SaveIndicator } from "@/components/SaveIndicator";
import { Button } from "@/components/ui/button";
import { COMPANIES, companyInfo, type Company } from "@/lib/goals";
import { currentKey, useCurrent, usePatchGoal } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { usePeople } from "@/lib/people";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/c/$company")({
  beforeLoad: ({ params }) => {
    if (!companyInfo(params.company)) throw notFound();
  },
  head: ({ params }) => {
    const name = companyInfo(params.company)?.name ?? "Empresa";
    return {
      meta: [
        { title: `${name} — Mi 411` },
        { name: "description", content: `Metas anuales, mensuales y semanales de ${name}.` },
        { property: "og:title", content: `${name} — Mi 411` },
        { property: "og:description", content: `Metas anuales, mensuales y semanales de ${name}.` },
      ],
    };
  },
  component: CompanyPage,
});

function CompanyPage() {
  const { company } = Route.useParams();
  const info = companyInfo(company)!;
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useCurrent();
  const onPatch = usePatchGoal(currentKey);
  const [full, setFull] = useState(false);
  const [filter, setFilter] = useState("all");
  const { data: people = [] } = usePeople();

  return (
    <main className={cn("mx-auto space-y-5 px-4 pb-28 pt-4 lg:pb-10", full ? "max-w-[1600px]" : "max-w-3xl")}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0">
            <Link to="/" aria-label="Volver">
              <ArrowLeft className="h-6 w-6" />
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-bold" style={{ color: full ? undefined : info.color }}>
            {full ? "Vista completa" : info.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator />
          <Button variant={full ? "default" : "outline"} className="hidden h-11 lg:inline-flex" onClick={() => setFull(!full)}>
            <Columns3 className="mr-1 h-5 w-5" /> Vista completa
          </Button>
        </div>
      </header>
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {data.snapshot.week_number ? `Semana ${data.snapshot.week_number} · ` : "Semana: "}<span className="font-medium text-foreground">{data.snapshot.label}</span>
          </p>
          {people.length > 0 && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-11 w-auto min-w-[11rem] text-sm" aria-label="Filtrar por responsable">
                <SelectValue placeholder="Filtrar por responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="min-h-11">Todos</SelectItem>
                <SelectItem value="none" className="min-h-11">Sin responsable</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="min-h-11">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {data &&
        (full ? (
          <div className="grid grid-cols-3 gap-5">
            {COMPANIES.map((c) => (
              <CompanyGoals
                key={c.id}
                data={data}
                company={c.id}
                onPatch={onPatch}
                showTitle
                assigneeFilter={filter}
                annualAsideBeside={false}
                annualAside={
                  <CompanyIssues
                    userId={user.id}
                    snapshotId={data.snapshot.id}
                    company={c.id}
                    color={c.color}
                  />
                }
              />
            ))}
          </div>
        ) : (
          <CompanyGoals
            data={data}
            company={company as Company}
            onPatch={onPatch}
            assigneeFilter={filter}
            annualAside={
              <CompanyIssues
                userId={user.id}
                snapshotId={data.snapshot.id}
                company={company as Company}
                color={info.color}
              />
            }
          />
        ))}

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-card/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {COMPANIES.map((c) => {
          const active = c.id === company;
          return (
            <Link
              key={c.id}
              to="/c/$company"
              params={{ company: c.id }}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold"
              style={{ color: active ? c.color : undefined }}
            >
              <span className="h-2 w-8 rounded-full" style={{ backgroundColor: active ? c.color : "var(--muted)" }} />
              <span className={active ? "" : "text-muted-foreground"}>{c.name}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
