import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageSquare, RotateCcw, Target, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/lib/btm-utils";
import { cn } from "@/lib/utils";

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

type Challenge = { id: string; habit: string; area: string; start_date: string };
type Day = { day_number: number; checked_on: string; comment: string };

const fmt = (k: string) => {
  const [y = 0, m = 1, d = 1] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
};

async function loadChallenge() {
  const { data: c, error } = await supabase
    .from("habit_challenges")
    .select("id, habit, area, start_date")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!c) return { challenge: null as Challenge | null, days: [] as Day[] };
  const { data: days, error: e2 } = await supabase
    .from("habit_challenge_days")
    .select("day_number, checked_on, comment")
    .eq("challenge_id", c.id);
  if (e2) throw e2;
  return { challenge: c as Challenge, days: (days ?? []) as Day[] };
}

export function Challenge66() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["challenge66"], queryFn: loadChallenge });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["challenge66"] });

  const challenge = data?.challenge ?? null;
  const days = data?.days ?? [];
  const byNum = new Map(days.map((d) => [d.day_number, d]));
  const count = days.length;
  const pct = Math.round((count / TOTAL) * 100);

  const start = async () => {
    const { error } = await supabase.from("habit_challenges").insert({ habit: "", start_date: todayKey() });
    if (error) {
      toast.error("No se pudo iniciar el reto");
      return;
    }
    refresh();
  };

  const updateChallenge = async (patch: Partial<Challenge>) => {
    if (!challenge) return;
    qc.setQueryData(["challenge66"], { challenge: { ...challenge, ...patch }, days });
    const { error } = await supabase.from("habit_challenges").update(patch).eq("id", challenge.id);
    if (error) {
      toast.error("No se pudo guardar");
      refresh();
    }
  };

  const toggle = async (n: number) => {
    if (!challenge) return;
    const existing = byNum.get(n);
    if (existing) {
      setSelected(n);
      return;
    }
    const row = { day_number: n, checked_on: todayKey(), comment: "" };
    qc.setQueryData(["challenge66"], { challenge, days: [...days, row] });
    setSelected(n);
    const { error } = await supabase.from("habit_challenge_days").insert({ challenge_id: challenge.id, ...row });
    if (error) {
      toast.error("No se pudo marcar el día");
      refresh();
    } else if (count + 1 === TOTAL) toast.success("¡66 días! ¡Lo lograste! 🎉");
  };

  const saveDay = async (n: number, patch: Partial<Day>) => {
    if (!challenge) return;
    qc.setQueryData(["challenge66"], {
      challenge,
      days: days.map((d) => (d.day_number === n ? { ...d, ...patch } : d)),
    });
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

  const uncheck = async (n: number) => {
    if (!challenge) return;
    const d = byNum.get(n);
    if (d?.comment && !confirm("Este día tiene comentarios. ¿Desmarcarlo de todos modos?")) return;
    qc.setQueryData(["challenge66"], { challenge, days: days.filter((x) => x.day_number !== n) });
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
    await start();
  };

  return (
    <section className="rounded-2xl bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center gap-3 p-4 text-left"
      >
        <Target className="h-6 w-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold">Reto 66 días</span>
          <span className="block truncate text-sm text-muted-foreground">
            {challenge
              ? `${challenge.habit || "Sin hábito definido"} · ${count} de ${TOTAL} días (${pct}%)`
              : "Un hábito a la vez"}
          </span>
          {challenge && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && !challenge && (
            <Button className="h-11" onClick={start}>
              Empezar reto de 66 días
            </Button>
          )}
          {challenge && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Hábito</span>
                  <HabitInput value={challenge.habit} onSave={(habit) => updateChallenge({ habit })} />
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
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggle(n)}
                      aria-pressed={!!d}
                      aria-label={`Día ${n}${d ? `, marcado ${fmt(d.checked_on)}` : ""}`}
                      className={cn(
                        "relative flex aspect-square min-h-11 flex-col items-start justify-between rounded-lg border p-1.5 text-left text-xs font-semibold transition",
                        d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50",
                        selected === n && "ring-2 ring-ring ring-offset-1",
                        n === TOTAL && !d && "border-primary/60 text-primary",
                      )}
                    >
                      <span>{n}</span>
                      {d && <Check className="h-4 w-4 self-end" />}
                      {d?.comment && <MessageSquare className="absolute right-1 top-1 h-3 w-3" />}
                      {n === TOTAL && !d && <span className="text-[9px] leading-none">¡Lo lograste!</span>}
                    </button>
                  );
                })}
              </div>

              {selected && byNum.get(selected) && (
                <DayPanel
                  key={selected}
                  n={selected}
                  day={byNum.get(selected)!}
                  onSave={(p) => saveDay(selected, p)}
                  onUncheck={() => uncheck(selected)}
                  onClose={() => setSelected(null)}
                />
              )}

              <button
                type="button"
                onClick={restart}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Archivar y empezar nuevo reto
              </button>
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
        <Button variant="ghost" className="h-11 text-destructive" onClick={onUncheck}>Desmarcar día</Button>
      </div>
    </div>
  );
}
