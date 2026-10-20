import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageSquare, Plus, RotateCcw, Target, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/lib/btm-utils";
import { cn } from "@/lib/utils";
import { createChallenge, daysForChallenge, loadChallenges, type Challenge, type ChallengeDay } from "@/lib/challenges";

const TOTAL = 66;
const AREAS = [
  ["espiritual", "Espiritual"],
  ["salud", "Salud física"],
  ["personal", "Personal"],
  ["relaciones", "Relaciones clave"],
  ["trabajo", "Trabajo"],
  ["negocio", "Negocio"],
  ["finanzas", "Finanzas"],
] as const;

type Day = ChallengeDay;

const fmt = (k: string) => {
  const [y = 0, m = 1, d = 1] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
};

export function Challenge66() {
  const qc = useQueryClient();
  const { data, isLoading, error: loadError } = useQuery({ queryKey: ["challenge66"], queryFn: loadChallenges });
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [ask, setAsk] = useState<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["challenge66"] });

  const challenges = data?.challenges ?? [];
  const challenge = challenges.find((c) => c.id === activeId) ?? challenges[0] ?? null;
  const days = challenge ? daysForChallenge(data?.days ?? [], challenge.id) : [];
  const byNum = new Map(days.map((d) => [d.day_number, d]));
  const selectedDay = selected === null ? undefined : byNum.get(selected);
  const askedDay = ask === null ? undefined : byNum.get(ask);
  const count = days.length;
  const pct = Math.round((count / TOTAL) * 100);

  const setDays = (nextDays: Day[]) => {
    if (!challenge) return;
    qc.setQueryData<Awaited<ReturnType<typeof loadChallenges>>>(["challenge66"], (current) => current && ({
      ...current,
      days: [...current.days.filter((d) => d.challenge_id !== challenge.id), ...nextDays],
    }));
  };

  const start = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createChallenge();
      qc.setQueryData<Awaited<ReturnType<typeof loadChallenges>>>(["challenge66"], (current) => ({
        challenges: [...(current?.challenges ?? []), created], days: current?.days ?? [],
      }));
      setActiveId(created.id);
      setSelected(null);
      setAsk(null);
      await refresh();
    } catch {
      toast.error("No se pudo iniciar el reto");
    } finally {
      setCreating(false);
    }
  };

  const updateChallenge = async (patch: Partial<Challenge>) => {
    if (!challenge) return;
    qc.setQueryData<Awaited<ReturnType<typeof loadChallenges>>>(["challenge66"], (current) => current && ({
      ...current, challenges: current.challenges.map((c) => c.id === challenge.id ? { ...c, ...patch } : c),
    }));
    const { error } = await supabase.from("habit_challenges").update(patch).eq("id", challenge.id);
    if (error) {
      toast.error("No se pudo guardar");
      refresh();
    }
  };

  const mark = async (n: number) => {
    if (!challenge) return;
    const row = { challenge_id: challenge.id, day_number: n, checked_on: todayKey(), comment: "" };
    setDays([...days, row]);
    setSelected(n);
    const { error } = await supabase.from("habit_challenge_days").insert(row);
    if (error) {
      toast.error("No se pudo marcar el día");
      refresh();
    } else if (count + 1 === TOTAL) toast.success("¡66 días! ¡Lo lograste! 🎉");
  };

  const saveDay = async (n: number, patch: Partial<Day>) => {
    if (!challenge) return;
    setDays(days.map((d) => (d.day_number === n ? { ...d, ...patch } : d)));
    const { error } = await supabase
      .from("habit_challenge_days")
      .update(patch)
      .eq("challenge_id", challenge.id)
      .eq("day_number", n);
    if (error) {
      toast.error("No se pudo guardar");
      refresh();
    }
  };

  const uncheck = async (n: number, guard = true) => {
    if (!challenge) return;
    const d = byNum.get(n);
    if (guard && d?.comment && !confirm("Este día tiene comentarios. ¿Desmarcarlo de todos modos?")) return;
    setDays(days.filter((x) => x.day_number !== n));
    setSelected(null);
    const { error } = await supabase
      .from("habit_challenge_days")
      .delete()
      .eq("challenge_id", challenge.id)
      .eq("day_number", n);
    if (error) {
      toast.error("No se pudo desmarcar");
      refresh();
    }
  };

  const restart = async () => {
    if (!challenge) return;
    if (!confirm("¿Archivar este reto y empezar uno nuevo? El reto actual se conserva archivado.")) return;
    const { error } = await supabase.from("habit_challenges").update({ active: false }).eq("id", challenge.id);
    if (error) {
      toast.error("No se pudo archivar");
      return;
    }
    setSelected(null);
    qc.setQueryData<Awaited<ReturnType<typeof loadChallenges>>>(["challenge66"], (current) => current && ({
      challenges: current.challenges.filter((c) => c.id !== challenge.id),
      days: current.days.filter((d) => d.challenge_id !== challenge.id),
    }));
    await start();
  };

  return (
    <section className="rounded-2xl bg-card shadow-soft">
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        variant="ghost"
        className="flex h-auto min-h-16 w-full items-center gap-3 whitespace-normal p-4 text-left"
      >
        <Target className="h-6 w-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold">Retos de 66 días</span>
          <span className="block truncate text-sm text-muted-foreground">
            {challenge
              ? `${challenge.habit || "Sin hábito definido"} · ${count} de ${TOTAL} días (${pct}%)`
              : "Sin retos activos"}
          </span>
          {challenge && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {loadError && <p role="alert" className="text-sm text-destructive">No se pudieron cargar tus retos.</p>}
          {!isLoading && !loadError && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {challenge && (
                <label className="min-w-0 flex-1 space-y-1 text-sm">
                  <span className="font-medium">Retos activos ({challenges.length})</span>
                  <select
                    value={challenge.id}
                    onChange={(e) => { setActiveId(e.target.value); setSelected(null); setAsk(null); }}
                    className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2"
                  >
                    {challenges.map((c, i) => (
                      <option key={c.id} value={c.id}>{c.habit || `Reto ${i + 1} sin hábito definido`} · {daysForChallenge(data?.days ?? [], c.id).length}/66</option>
                    ))}
                  </select>
                </label>
              )}
              <Button className="h-11 shrink-0" onClick={start} disabled={creating}>
                <Plus className="h-4 w-4" /> {creating ? "Creando…" : "Nuevo reto"}
              </Button>
            </div>
          )}
          {challenge && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Hábito</span>
                  <HabitInput key={challenge.id} value={challenge.habit} onSave={(habit) => updateChallenge({ habit })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Área</span>
                  <select
                    value={challenge.area}
                    onChange={(e) => updateChallenge({ area: e.target.value })}
                    className="h-11 w-full rounded-lg border border-input bg-background px-2"
                  >
                    {AREAS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Inicio</span>
                  <input
                    type="date"
                    value={challenge.start_date}
                    onChange={(e) => e.target.value && updateChallenge({ start_date: e.target.value })}
                    className="h-11 w-full rounded-lg border border-input bg-background px-2"
                  />
                </label>
              </div>

              <p className="font-display text-2xl font-bold">
                {count} <span className="text-base font-medium text-muted-foreground">de {TOTAL} días marcados · faltan {TOTAL - count}</span>
              </p>

              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => {
                  const d = byNum.get(n);
                  return (
                    <Button
                      key={n}
                      type="button"
                      variant="ghost"
                      onClick={() => setAsk(n)}
                      aria-pressed={!!d}
                      aria-label={`Día ${n}${d ? `, marcado ${fmt(d.checked_on)}` : ""}`}
                      className={cn(
                        "relative flex h-auto aspect-square min-h-11 flex-col items-start justify-between overflow-hidden rounded-lg border p-1.5 text-left text-xs font-semibold transition [&>svg.challenge-cross]:size-full",
                        d ? "border-destructive/60 bg-background" : "border-border bg-background hover:border-primary/50",
                        selected === n && "ring-2 ring-ring ring-offset-1",
                        n === TOTAL && !d && "border-primary/60 text-primary",
                      )}
                    >
                      <span className={cn("relative z-10 rounded bg-background px-1 leading-tight", d && "text-muted-foreground")}>{n}</span>
                      {d && (
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden
                           className="challenge-cross pointer-events-none absolute inset-0 h-full w-full text-destructive"
                        >
                          <line x1="3" y1="3" x2="97" y2="97" stroke="currentColor" strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                          <line x1="97" y1="3" x2="3" y2="97" stroke="currentColor" strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                        </svg>
                      )}
                      {d?.comment && <MessageSquare className="absolute right-1 top-1 z-10 h-3 w-3" />}
                      {n === TOTAL && !d && <span className="text-[9px] leading-none">¡Lo lograste!</span>}
                    </Button>
                  );
                })}
              </div>

              {selected !== null && selectedDay && (
                <DayPanel
                  key={`${challenge.id}-${selected}`}
                  n={selected}
                  day={selectedDay}
                  onSave={(p) => saveDay(selected, p)}
                  onUncheck={() => uncheck(selected)}
                  onClose={() => setSelected(null)}
                />
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={restart}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Archivar y empezar nuevo reto
              </Button>

              {ask !== null && (
                <AlertDialog open onOpenChange={(o) => !o && setAsk(null)}>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {askedDay ? `¿Quitar la X del día ${ask}?` : `¿Marcar el día ${ask}?`}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {askedDay
                          ? `Está marcado como cumplido el ${fmt(askedDay.checked_on)}.${
                              askedDay.comment ? " También se borrará su comentario." : ""
                            }`
                          : `Se marcará como cumplido hoy, ${fmt(todayKey())}.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-2">
                      {askedDay ? (
                        <>
                          <AlertDialogAction
                            className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              const n = ask;
                              setAsk(null);
                              uncheck(n, false);
                            }}
                          >
                            <X className="h-4 w-4" /> Quitar la X
                          </AlertDialogAction>
                          <AlertDialogAction
                            className="h-11"
                            onClick={() => {
                              const n = ask;
                              setAsk(null);
                              setSelected(n);
                            }}
                          >
                            <MessageSquare className="h-4 w-4" /> Comentario o fecha
                          </AlertDialogAction>
                        </>
                      ) : (
                        <AlertDialogAction
                          className="h-11"
                          onClick={() => {
                            const n = ask;
                            setAsk(null);
                            mark(n);
                          }}
                        >
                          Marcar día {ask}
                        </AlertDialogAction>
                      )}
                      <AlertDialogCancel className="mt-0 h-11">Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function HabitInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      placeholder="Ej. Leer 30 minutos"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-11 w-full rounded-lg border border-input bg-background px-3"
    />
  );
}

function DayPanel({
  n,
  day,
  onSave,
  onUncheck,
  onClose,
}: {
  n: number;
  day: Day;
  onSave: (p: Partial<Day>) => void;
  onUncheck: () => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(day.comment);
  useEffect(() => {
    if (comment === day.comment) return;
    const t = setTimeout(() => onSave({ comment }), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment]);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg font-semibold">Día {n}</span>
        <input
          type="date"
          value={day.checked_on}
          onChange={(e) => e.target.value && onSave({ checked_on: e.target.value })}
          aria-label="Fecha del día"
          className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
        />
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={() => comment !== day.comment && onSave({ comment })}
        placeholder="Comentarios de este día…"
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11" onClick={onClose}>Listo</Button>
        <Button variant="outline" className="h-11 text-destructive" onClick={onUncheck}>
          <X className="h-4 w-4" /> Quitar la X de este día
        </Button>
      </div>
    </div>
  );
}
