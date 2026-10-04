import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Agenda, BtmStatusBadge, FollowUp, PriorityList } from "@/components/btm/BtmFields";
import { useBtmMutations, useDayPlan, useSavedDates, useWeekPlan } from "@/lib/btm";
import {
  addDaysKey,
  dayName,
  formatMinutes,
  fromKey,
  isDateKey,
  longDate,
  mondayKey,
  shortDate,
  todayKey,
  toKey,
  totalMinutes,
} from "@/lib/btm-utils";
import { cn } from "@/lib/utils";

type Search = { view?: "day" | "week" | undefined; date?: string | undefined };

export const Route = createFileRoute("/_authenticated/btm")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    view: s["view"] === "week" ? "week" : undefined,
    date: isDateKey(s["date"]) ? s["date"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Mi 411 — BTM planeación" },
      { name: "description", content: "Planeación semanal y diaria: prioridades, tiempos, seguimiento y agenda." },
      { property: "og:title", content: "Mi 411 — BTM planeación" },
      { property: "og:description", content: "Planeación semanal y diaria: prioridades, tiempos, seguimiento y agenda." },
    ],
  }),
  component: BtmPage,
});

function BtmPage() {
  const search = Route.useSearch();
  const view = search.view ?? "day";
  const date = search.date ?? todayKey();
  const navigate = useNavigate({ from: "/btm" });
  const go = (s: Search) => navigate({ search: { view: s.view === "week" ? "week" : undefined, date: s.date }, replace: true });
  const step = view === "week" ? 7 : 1;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-6">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11">
          <Link to="/" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="truncate text-2xl font-bold">BTM</h1>
        <BtmStatusBadge />
      </header>

      <div role="tablist" aria-label="Vista" className="grid grid-cols-2 rounded-xl bg-muted p-1">
        {(["day", "week"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => go({ view: v, date })}
            className={cn("min-h-11 rounded-lg font-medium", view === v ? "bg-card shadow-soft" : "text-muted-foreground")}
          >
            {v === "day" ? "Día" : "Semana"}
          </button>
        ))}
      </div>

      <nav className="flex items-center gap-1" aria-label="Navegación de fechas">
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Anterior" onClick={() => go({ view, date: addDaysKey(date, -step) })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <DatePicker date={date} onPick={(d) => go({ view, date: d })} label={view === "week" ? weekTitle(date) : longDate(date)} />
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Siguiente" onClick={() => go({ view, date: addDaysKey(date, step) })}>
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="outline" className="h-11 shrink-0" onClick={() => go({ view, date: undefined })}>
          Hoy
        </Button>
      </nav>

      {view === "day" ? <DayView day={date} /> : <WeekView monday={mondayKey(date)} onOpenDay={(d) => go({ view: "day", date: d })} />}
    </main>
  );
}

function weekTitle(date: string) {
  const m = mondayKey(date);
  return `Semana ${shortDate(m)} – ${shortDate(addDaysKey(m, 6))}`;
}

function DatePicker({ date, onPick, label }: { date: string; onPick: (d: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const { data: saved = [] } = useSavedDates();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-11 min-w-0 flex-1 justify-center gap-2 font-display font-semibold">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="single"
          locale={es}
          weekStartsOn={1}
          selected={fromKey(date)}
          defaultMonth={fromKey(date)}
          onSelect={(d) => {
            if (!d) return;
            onPick(toKey(d));
            setOpen(false);
          }}
          modifiers={{ saved: saved.map(fromKey) }}
          modifiersClassNames={{
            saved: "relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
          }}
          className="pointer-events-auto p-3"
        />
        {saved.length > 0 && (
          <div className="max-h-48 overflow-y-auto border-t border-border p-2">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Días guardados</p>
            {saved.slice(0, 30).map((d) => (
              <button
                key={d}
                onClick={() => {
                  onPick(d);
                  setOpen(false);
                }}
                className="block min-h-11 w-full rounded-lg px-2 text-left text-sm hover:bg-muted"
              >
                {longDate(d)}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DayView({ day }: { day: string }) {
  const { data, isLoading, error } = useDayPlan(day);
  const m = useBtmMutations();
  if (isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (error || !data) return <p className="text-destructive">No se pudo cargar el día.</p>;
  // Keyed by day: switching dates remounts editors so pending text is saved to the date where it was typed.
  return (
    <div key={day} className="space-y-4">
      <PriorityList scope="day" refDate={day} priorities={data.priorities} onSave={m.savePriority} />
      <FollowUp day={day} value={data.follow_up} onSave={m.saveFollowUp} />
      <Agenda day={day} blocks={data.blocks} onSave={m.saveBlock} onDelete={m.deleteBlock} />
    </div>
  );
}

function WeekView({ monday, onOpenDay }: { monday: string; onOpenDay: (d: string) => void }) {
  const { data, isLoading, error } = useWeekPlan(monday);
  const m = useBtmMutations();
  if (isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (error || !data) return <p className="text-destructive">No se pudo cargar la semana.</p>;
  const today = todayKey();
  return (
    <div key={monday} className="space-y-4">
      <PriorityList scope="week" refDate={monday} priorities={data.priorities} onSave={m.savePriority} />
      <section className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="mb-2 font-display text-lg font-semibold">Resumen de la semana</h2>
        <ul className="divide-y divide-border">
          {data.days.map((d) => {
            const done = d.priorities.filter((p) => p.done).length;
            return (
              <li key={d.day}>
                <button onClick={() => onOpenDay(d.day)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <span className={cn("w-24 shrink-0 font-medium", d.day === today && "text-primary")}>
                    {dayName(d.day)}
                    <span className="block text-xs text-muted-foreground">{shortDate(d.day)}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {d.priorities.length
                      ? d.priorities
                          .sort((a, b) => a.position - b.position)
                          .map((p) => p.text || `A${p.position}`)
                          .join(" · ")
                      : "Sin plan"}
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {d.priorities.length > 0 && (
                      <>
                        {done}/{d.priorities.length}
                        <br />
                        {formatMinutes(totalMinutes(d.priorities))}
                      </>
                    )}
                    {d.blocks > 0 && <span className="block">{d.blocks} bloques</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
