import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { blockKey, dayKey, MAX_PRIORITIES, prioKey, weekDays } from "./btm-utils";

export type Scope = "day" | "week";
export type Priority = { scope: Scope; ref_date: string; position: number; text: string; minutes: number | null; done: boolean };
export type Block = { id: string; day: string; start_time: string; end_time: string; activity: string };
export type DayPlan = { day: string; follow_up: string; priorities: Priority[]; blocks: Block[] };

type Op =
  | { t: "prio"; row: Priority }
  | { t: "day"; day: string; follow_up: string }
  | { t: "block"; row: Block }
  | { t: "block-del"; id: string; day: string };

export type BtmStatus = "idle" | "pending" | "saving" | "saved" | "error";

// ---------- Offline-tolerant queue (localStorage) ----------
const KEY = "mi411-btm-pending-v1";
let pending: Record<string, Op> = {};
let status: BtmStatus = "idle";
const listeners = new Set<(s: BtmStatus) => void>();
let flushing = false;
let retry: ReturnType<typeof setTimeout> | undefined;
let toastShown = false;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}
function setStatus(s: BtmStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export function subscribeBtm(fn: (s: BtmStatus) => void) {
  listeners.add(fn);
  fn(status);
  return () => void listeners.delete(fn);
}
export function useBtmStatus() {
  const [s, setS] = useState<BtmStatus>("idle");
  useEffect(() => subscribeBtm(setS), []);
  return s;
}

function enqueue(key: string, op: Op) {
  pending[key] = op;
  persist();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus("pending");
    return;
  }
  setStatus("pending");
  void flushBtm();
}

async function run(op: Op) {
  if (op.t === "prio") {
    const r = op.row;
    return supabase.from("btm_priorities").upsert(
      { scope: r.scope, ref_date: r.ref_date, position: r.position, text: r.text, minutes: r.minutes, done: r.done },
      { onConflict: "user_id,scope,ref_date,position" },
    );
  }
  if (op.t === "day")
    return supabase.from("btm_days").upsert({ day: op.day, follow_up: op.follow_up }, { onConflict: "user_id,day" });
  if (op.t === "block") {
    const r = op.row;
    return supabase
      .from("btm_blocks")
      .upsert({ id: r.id, day: r.day, start_time: r.start_time, end_time: r.end_time, activity: r.activity });
  }
  return supabase.from("btm_blocks").delete().eq("id", op.id);
}

export async function flushBtm() {
  if (flushing) return;
  const keys = Object.keys(pending);
  if (!keys.length) return;
  flushing = true;
  setStatus("saving");
  let failed = false;
  for (const k of keys) {
    const op = pending[k];
    if (!op) continue;
    try {
      const { error } = await run(op);
      if (error) {
        // A check-constraint violation (23514) will never succeed on retry: drop it and tell the user.
        if (error.code === "23514" || error.code === "22P02") {
          if (pending[k] === op) delete pending[k];
          toast.error("Un dato no es válido y no se guardó (revisa horas y duraciones).");
          failed = true;
          continue;
        }
        throw error;
      }
      if (pending[k] === op) delete pending[k];
    } catch {
      failed = true;
    }
  }
  persist();
  flushing = false;
  if (failed) {
    setStatus("error");
    if (!toastShown) {
      toastShown = true;
      toast.error("No se pudo guardar el plan. Tus cambios quedan en este dispositivo y se reintentarán.");
    }
    clearTimeout(retry);
    if (Object.keys(pending).length) retry = setTimeout(() => void flushBtm(), 5000);
  } else if (Object.keys(pending).length) {
    void flushBtm();
  } else {
    toastShown = false;
    setStatus("saved");
  }
}

if (typeof window !== "undefined") {
  try {
    pending = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    pending = {};
  }
  if (Object.keys(pending).length) status = "pending";
  window.addEventListener("online", () => void flushBtm());
  setTimeout(() => void flushBtm(), 1000);
}

// ---------- Reads (with local pending edits overlaid) ----------
function overlayPrios(rows: Priority[], scope: Scope, refs: string[]) {
  const map = new Map(rows.map((r) => [prioKey(r.scope, r.ref_date, r.position), r]));
  for (const op of Object.values(pending))
    if (op.t === "prio" && op.row.scope === scope && refs.includes(op.row.ref_date))
      map.set(prioKey(op.row.scope, op.row.ref_date, op.row.position), op.row);
  return [...map.values()];
}

export async function fetchDay(day: string): Promise<DayPlan> {
  const [d, p, b] = await Promise.all([
    supabase.from("btm_days").select("day, follow_up").eq("day", day).maybeSingle(),
    supabase.from("btm_priorities").select("scope, ref_date, position, text, minutes, done").eq("scope", "day").eq("ref_date", day),
    supabase.from("btm_blocks").select("id, day, start_time, end_time, activity").eq("day", day),
  ]);
  if (d.error) throw d.error;
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  const dayOp = pending[dayKey(day)];
  const blocks = new Map((b.data ?? []).map((x) => [x.id, x as Block]));
  for (const op of Object.values(pending)) {
    if (op.t === "block" && op.row.day === day) blocks.set(op.row.id, op.row);
    if (op.t === "block-del" && op.day === day) blocks.delete(op.id);
  }
  return {
    day,
    follow_up: dayOp?.t === "day" ? dayOp.follow_up : (d.data?.follow_up ?? ""),
    priorities: overlayPrios((p.data ?? []) as Priority[], "day", [day]),
    blocks: [...blocks.values()].sort((x, y) => x.start_time.localeCompare(y.start_time)),
  };
}

export type WeekPlan = { monday: string; priorities: Priority[]; days: { day: string; priorities: Priority[]; blocks: number }[] };

export async function fetchWeek(monday: string): Promise<WeekPlan> {
  const days = weekDays(monday);
  const [w, p, b] = await Promise.all([
    supabase.from("btm_priorities").select("scope, ref_date, position, text, minutes, done").eq("scope", "week").eq("ref_date", monday),
    supabase.from("btm_priorities").select("scope, ref_date, position, text, minutes, done").eq("scope", "day").gte("ref_date", days[0]!).lte("ref_date", days[6]!),
    supabase.from("btm_blocks").select("id, day").gte("day", days[0]!).lte("day", days[6]!),
  ]);
  if (w.error) throw w.error;
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  const dayPrios = overlayPrios((p.data ?? []) as Priority[], "day", days);
  return {
    monday,
    priorities: overlayPrios((w.data ?? []) as Priority[], "week", [monday]),
    days: days.map((day) => ({
      day,
      priorities: dayPrios.filter((x) => x.ref_date === day && (x.text.trim() || x.minutes)),
      blocks: (b.data ?? []).filter((x) => x.day === day).length,
    })),
  };
}

export async function fetchSavedDates(): Promise<string[]> {
  const [d, p, b] = await Promise.all([
    supabase.from("btm_days").select("day").neq("follow_up", ""),
    supabase.from("btm_priorities").select("ref_date").eq("scope", "day"),
    supabase.from("btm_blocks").select("day"),
  ]);
  const s = new Set<string>();
  d.data?.forEach((x) => s.add(x.day));
  p.data?.forEach((x) => s.add(x.ref_date));
  b.data?.forEach((x) => s.add(x.day));
  return [...s].sort().reverse();
}

export const dayQK = (day: string) => ["btm", "day", day] as const;
export const weekQK = (m: string) => ["btm", "week", m] as const;
export const datesQK = ["btm", "dates"] as const;

export const useDayPlan = (day: string) => useQuery({ queryKey: dayQK(day), queryFn: () => fetchDay(day) });
export const useWeekPlan = (m: string) => useQuery({ queryKey: weekQK(m), queryFn: () => fetchWeek(m) });
export const useSavedDates = () => useQuery({ queryKey: datesQK, queryFn: fetchSavedDates });

/** Every mutator receives the full identity (date/scope/slot) captured at edit time. */
export function useBtmMutations() {
  const qc = useQueryClient();
  const touch = (day: string | null) => {
    qc.invalidateQueries({ queryKey: ["btm", "week"] });
    if (day) qc.invalidateQueries({ queryKey: datesQK });
  };
  const savePriority = useCallback(
    (row: Priority) => {
      if (row.position < 1 || row.position > MAX_PRIORITIES) return;
      if (row.minutes != null && !(row.minutes > 0)) return;
      if (row.scope === "day")
        qc.setQueryData<DayPlan>(dayQK(row.ref_date), (o) =>
          o ? { ...o, priorities: [...o.priorities.filter((p) => p.position !== row.position), row] } : o,
        );
      else
        qc.setQueryData<WeekPlan>(weekQK(row.ref_date), (o) =>
          o ? { ...o, priorities: [...o.priorities.filter((p) => p.position !== row.position), row] } : o,
        );
      enqueue(prioKey(row.scope, row.ref_date, row.position), { t: "prio", row });
      touch(row.scope === "day" ? row.ref_date : null);
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const saveFollowUp = useCallback(
    (day: string, follow_up: string) => {
      qc.setQueryData<DayPlan>(dayQK(day), (o) => (o ? { ...o, follow_up } : o));
      enqueue(dayKey(day), { t: "day", day, follow_up });
      touch(day);
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const saveBlock = useCallback(
    (row: Block) => {
      qc.setQueryData<DayPlan>(dayQK(row.day), (o) =>
        o
          ? { ...o, blocks: [...o.blocks.filter((b) => b.id !== row.id), row].sort((x, y) => x.start_time.localeCompare(y.start_time)) }
          : o,
      );
      enqueue(blockKey(row.id), { t: "block", row });
      touch(row.day);
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const deleteBlock = useCallback(
    (id: string, day: string) => {
      qc.setQueryData<DayPlan>(dayQK(day), (o) => (o ? { ...o, blocks: o.blocks.filter((b) => b.id !== id) } : o));
      enqueue(blockKey(id), { t: "block-del", id, day });
      touch(day);
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { savePriority, saveFollowUp, saveBlock, deleteBlock };
}
