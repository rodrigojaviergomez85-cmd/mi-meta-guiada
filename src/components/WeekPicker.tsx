import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, getISOWeek, getISOWeekYear, getISOWeeksInYear, isSunday, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEPT", "OCT", "NOV", "DIC"];
const MONTHS_LOWER = MONTHS.map((m) => m.toLowerCase());

export const mondayOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

export function parseDate(s: string) {
  return new Date(s + "T00:00");
}

export type WeekInfo = {
  label: string;
  week_label: string;
  month_label: string;
  week_start: string;
  week_end: string;
  week_number: number;
  year: number;
  weeksInYear: number;
  range: string;
};

export function weekInfo(monday: Date): WeekInfo {
  const sat = addDays(monday, 5);
  const m1 = monday.getMonth();
  const m2 = sat.getMonth();
  const week_label =
    m1 === m2
      ? `${monday.getDate()}–${sat.getDate()} ${MONTHS[m1]}`
      : `${monday.getDate()} ${MONTHS[m1]} – ${sat.getDate()} ${MONTHS[m2]}`;
  return {
    label: `${monday.getMonth() + 1}.${String(monday.getDate()).padStart(2, "0")}.${String(monday.getFullYear()).slice(2)}`,
    week_label,
    month_label: MONTHS[m1]!,
    week_start: format(monday, "yyyy-MM-dd"),
    week_end: format(sat, "yyyy-MM-dd"),
    week_number: getISOWeek(monday),
    year: getISOWeekYear(monday),
    weeksInYear: getISOWeeksInYear(monday),
    range: rangeText(monday, sat),
  };
}

export function rangeText(a: Date, b: Date) {
  return `${a.getDate()} ${MONTHS_LOWER[a.getMonth()]} – ${b.getDate()} ${MONTHS_LOWER[b.getMonth()]}`;
}

type Existing = { id: string; label: string; week_start: string | null; snapshot_date: string };

export function useExistingWeeks() {
  return useQuery({
    queryKey: ["snapshotWeeks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("snapshots").select("id, label, week_start, snapshot_date");
      if (error) throw error;
      return (data ?? []) as Existing[];
    },
  });
}

/** Returns the existing snapshot (other than excludeId) whose week matches the given Monday. */
export function findExisting(list: Existing[], monday: Date, excludeId?: string) {
  const key = format(monday, "yyyy-MM-dd");
  return list.find(
    (s) => s.id !== excludeId && format(mondayOf(parseDate(s.week_start ?? s.snapshot_date)), "yyyy-MM-dd") === key,
  );
}

/** First week from today on (Sunday counts as next week) that isn't already in the history. */
export function defaultMonday(list: Existing[]) {
  const today = new Date();
  let m = mondayOf(isSunday(today) ? addDays(today, 1) : today);
  for (let i = 0; i < 52 && findExisting(list, m); i++) m = addDays(m, 7);
  return m;
}

export function WeekPicker({
  monday,
  onChange,
  excludeId,
}: {
  monday: Date;
  onChange: (m: Date) => void;
  excludeId?: string | undefined;
}) {
  const [month, setMonth] = useState(monday);
  const key = monday.getTime();
  useEffect(() => setMonth(monday), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: existing = [] } = useExistingWeeks();
  const info = weekInfo(monday);
  const dup = findExisting(existing, monday, excludeId);
  const remaining = info.weeksInYear - info.week_number;
  const week = Array.from({ length: 6 }, (_, i) => addDays(monday, i));
  const existingDays = existing
    .filter((s) => s.id !== excludeId)
    .map((s) => mondayOf(parseDate(s.week_start ?? s.snapshot_date)));

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted p-3">
        <p className="font-display font-bold">
          Semana {info.week_number} de {info.weeksInYear} · {info.year}
        </p>
        <p className="text-sm">{info.range}</p>
        <p className="text-sm text-muted-foreground">
          {remaining === 1 ? "Queda 1 semana del año" : `Quedan ${remaining} semanas del año`}
        </p>
      </div>
      {dup && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Ya existe una semana con estas fechas (etiqueta {dup.label})
        </p>
      )}
      <div className="flex flex-col items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 self-end px-3 text-xs"
          onClick={() => {
            const t = mondayOf(new Date());
            onChange(t);
            setMonth(t);
          }}
        >
          Hoy
        </Button>
        <Calendar
          mode="single"
          locale={es}
          weekStartsOn={1}
          month={month}
          onMonthChange={setMonth}
          selected={undefined}
          onDayClick={(d) => onChange(mondayOf(d))}
          modifiers={{ inWeek: week, sunday: (d: Date) => isSunday(d), existing: existingDays }}
          modifiersClassNames={{
            inWeek: "bg-primary/20 [&_button]:font-bold",
            sunday: "opacity-40",
            existing: "relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
          }}
          className={cn("pointer-events-auto rounded-xl [--cell-size:2.5rem]")}
        />
      </div>
    </div>
  );
}
