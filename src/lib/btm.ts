import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { blockKey, dayKey, MAX_PRIORITIES, prioKey, weekDays } from "./btm-utils";

export type Scope = "day" | "week";
export type Priority = { scope: Scope; ref_date: string; position: number; text: string; minutes: number | null; done: boolean };
export type Block = { id: string; day: string; start_time: string; end_time: string; activity: string };
export type DayPlan = { day: string; follow_up: string; priorities: Priority[]; blocks: Block[] };

type OpBody =
  | { t: "prio"; row: Priority }
  | { t: "day"; day: string; follow_up: string }
  | { t: "block"; row: Block }
  | { t: "block-del"; id: string; day: string };
/** Every queued op is bound to the user who made the edit; `rejected` = the database refused it (kept, not retried). */
export type Op = OpBody & { user_id: string; rejected?: boolean };

export type BtmStatus = "idle" | "pending" | "saving" | "saved" | "error";

// ---------- Per-user offline queue ----------
// Storage is per user. The legacy un-owned key "mi411-btm-pending-v1" is never read or sent: its owner can't be known.
export const storageKey = (uid: string) => `mi411-btm-pending-v2:${uid}`;
export const NETWORK_DEBOUNCE_MS = 800;

let currentUser: string | null = null;
let pending: Record<string, Op> = {};
const deleted = new Set<string>(); // block ids deleted in this session: never re-upsert
let status: BtmStatus = "idle";
const statusListeners = new Set<(s: BtmStatus) => void>();
const userListeners = new Set<(u: string | null) => void>();
const savedListeners = new Set<(uid: string) => void>();
let flushing = false;
let again = false;
let netTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let toastShown = false;

function load(uid: string): Record<string, Op> {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(uid)) || "{}") as Record<string, Op>;
    // Only keep ops explicitly owned by this user.
    return Object.fromEntries(Object.entries(raw).filter(([, op]) => op && op.user_id === uid));
  } catch {
    return {};
  }
}
function persist(uid: string, map: Record<string, Op>) {
  try {
    if (Object.keys(map).length) localStorage.setItem(storageKey(uid), JSON.stringify(map));
    else localStorage.removeItem(storageKey(uid));
  } catch {
    /* ignore */
  }
}
function setStatus(s: BtmStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}
const hasRejected = (m: Record<string, Op>) => Object.values(m).some((o) => o.rejected);
const sendable = (m: Record<string, Op>) => Object.keys(m).filter((k) => !m[k]!.rejected);

export function subscribeBtm(fn: (s: BtmStatus) => void) {
  statusListeners.add(fn);
  fn(status);
  return () => void statusListeners.delete(fn);
}
export function onBtmSaved(fn: (uid: string) => void) {
  savedListeners.add(fn);
  return () => void savedListeners.delete(fn);
}
export function getBtmUser() {
  return currentUser;
}
export function getPending(): Readonly<Record<string, Op>> {
  return pending;
}

export function setBtmUser(uid: string | null) {
  if (uid === currentUser) return;
  clearTimeout(netTimer);
  clearTimeout(retryTimer);
  currentUser = uid;
  pending = uid ? load(uid) : {};
  deleted.clear();
  toastShown = false;
  const n = Object.keys(pending).length;
  setStatus(!n ? "idle" : hasRejected(pending) ? "error" : "pending");
  userListeners.forEach((l) => l(uid));
  if (uid && sendable(pending).length) scheduleFlush(0);
}

/** Test helper: forget in-memory state (simulates a page reload). */
export function __resetBtm() {
  clearTimeout(netTimer);
  clearTimeout(retryTimer);
  currentUser = null;
  pending = {};
  deleted.clear();
  flushing = false;
  again = false;
  toastShown = false;
  status = "idle";
}

function scheduleFlush(ms: number) {
  clearTimeout(netTimer);
  netTimer = setTimeout(() => void flushBtm(), ms);
}

/** Persists locally right away (survives closing the tab); the network write is debounced. */
function enqueue(key: string, body: OpBody): boolean {
  const uid = currentUser;
  if (!uid) return false;
  if (body.t === "block" && (deleted.has(body.row.id) || pending[key]?.t === "block-del")) return false;
  if (body.t === "block-del") deleted.add(body.id);
  pending[key] = { ...body, user_id: uid };
  persist(uid, pending);
  setStatus(hasRejected(pending) ? "error" : "pending");
  scheduleFlush(NETWORK_DEBOUNCE_MS);
  return true;
}

async function run(op: Op) {
  const user_id = op.user_id;
  if (op.t === "prio") {
    const r = op.row;
    return supabase.from("btm_priorities").upsert(
      { user_id, scope: r.scope, ref_date: r.ref_date, position: r.position, text: r.text, minutes: r.minutes, done: r.done },
      { onConflict: "user_id,scope,ref_date,position" },
    );
  }
  if (op.t === "day")
    return supabase.from("btm_days").upsert({ user_id, day: op.day, follow_up: op.follow_up }, { onConflict: "user_id,day" });
  if (op.t === "block") {
    const r = op.row;
    return supabase
      .from("btm_blocks")
      .upsert({ id: r.id, user_id, day: r.day, start_time: r.start_time, end_time: r.end_time, activity: r.activity });
  }
  return supabase.from("btm_blocks").delete().eq("id", op.id).eq("user_id", user_id);
}

const PERMANENT = new Set(["23514", "22P02", "22007", "22008", "23502"]);

export async function flushBtm() {
  if (flushing) {
    again = true;
    return;
  }
  const uid = currentUser;
  if (!uid) return;
  const map = pending; // this user's map; a session switch replaces `pending` and we stop
  if (!sendable(map).length) return;
  flushing = true;
  again = false;
  setStatus("saving");
  let failed = false;
  let rejectedNow = false;
  let saved = false;
  for (const k of sendable(map)) {
    if (currentUser !== uid) break; // session changed: never send A's ops as B
    const op = map[k];
    if (!op || op.rejected || op.user_id !== uid) continue;
    try {
      const { error } = await run(op);
      if (error) {
        if (error.code && PERMANENT.has(error.code)) {
          if (map[k] === op) map[k] = { ...op, rejected: true }; // keep it, recoverable, not retried
          rejectedNow = true;
          continue;
        }
        throw error;
      }
      if (map[k] === op) delete map[k];
      saved = true;
    } catch {
      failed = true;
      break;
    }
  }
  persist(uid, map);
  flushing = false;
  if (saved) savedListeners.forEach((l) => l(uid));
  if (currentUser !== uid) return;
  if (rejectedNow) toast.error("Un dato no es válido (hora o duración) y no se guardó. Sigue en este dispositivo: corrígelo para guardarlo.");
  if (failed) {
    setStatus("error");
    if (!toastShown) {
      toastShown = true;
      toast.error("No se pudo guardar el plan. Tus cambios quedan en este dispositivo y se reintentarán.");
    }
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void flushBtm(), 5000);
    return;
  }
  if (again || sendable(map).length) {
    void flushBtm();
    return;
  }
  toastShown = false;
  setStatus(hasRejected(map) ? "error" : Object.keys(map).length ? "pending" : "saved");
}

if (typeof window !== "undefined" && !import.meta.env.VITEST) {
  window.addEventListener("online", () => void flushBtm());
  window.addEventListener("pagehide", () => currentUser && persist(currentUser, pending));
  void supabase.auth.getSession().then(({ data }) => setBtmUser(data.session?.user.id ?? null));
  supabase.auth.onAuthStateChange((_e, session) => setBtmUser(session?.user.id ?? null));
}

export function useBtmStatus() {
  const [s, setS] = useState<BtmStatus>(status);
  useEffect(() => subscribeBtm(setS), []);
  return s;
}
export function useBtmUser() {
  const [u, setU] = useState<string | null>(currentUser);
  useEffect(() => {
    userListeners.add(setU);
    setU(currentUser);
    return () => void userListeners.delete(setU);
  }, []);
  return u;
}

// ---------- Reads (only this user's pending edits are overlaid) ----------
function myOps(uid: string) {
  return uid === currentUser ? Object.values(pending).filter((o) => o.user_id === uid) : [];
}
function overlayPrios(uid: string, rows: Priority[], scope: Scope, refs: string[]) {
  const map = new Map(rows.map((r) => [prioKey(r.scope, r.ref_date, r.position), r]));
  for (const op of myOps(uid))
    if (op.t === "prio" && op.row.scope === scope && refs.includes(op.row.ref_date))
      map.set(prioKey(op.row.scope, op.row.ref_date, op.row.position), op.row);
  return [...map.values()];
}

export async function fetchDay(uid: string, day: string): Promise<DayPlan> {
  const [d, p, b] = await Promise.all([
    supabase.from("btm_days").select("day, follow_up").eq("user_id", uid).eq("day", day).maybeSingle(),
    supabase.from("btm_priorities").select("scope, ref_date, position, text, minutes, done").eq("user_id", uid).eq("scope", "day").eq("ref_date", day),
    supabase.from("btm_blocks").select("id, day, start_time, end_time, activity").eq("user_id", uid).eq("day", day),
  ]);
  if (d.error) throw d.error;
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  const ops = myOps(uid);
  const dayOp = ops.find((o) => o.t === "day" && o.day === day);
  const blocks = new Map(((b.data ?? []) as Block[]).map((x) => [x.id, x]));
  for (const op of ops) {
    if (op.t === "block" && op.row.day === day) blocks.set(op.row.id, op.row);
    if (op.t === "block-del" && op.day === day) blocks.delete(op.id);
  }
  return {
    day,
    follow_up: dayOp?.t === "day" ? dayOp.follow_up : ((d.data as { follow_up?: string } | null)?.follow_up ?? ""),
    priorities: overlayPrios(uid, (p.data ?? []) as Priority[], "day", [day]),
    blocks: [...blocks.values()].sort((x, y) => x.start_time.localeCompare(y.start_time)),
  };
}

export type WeekPlan = { monday: string; priorities: Priority[]; days: { day: string; priorities: Priority[]; blocks: number }[] };

export async function fetchWeek(uid: string, monday: string): Promise<WeekPlan> {
  const days = weekDays(monday);
  const [w, p, b] = await Promise.all([
    supabase.from("btm_priorities").select("scope, ref_date, position, text, minutes, done").eq("user_id", uid).eq("scope", "week").eq("ref_date", monday),
    supabase.from("btm_priorities").select("scope, ref_date, position, text, minutes, done").eq("user_id", uid).eq("scope", "day").gte("ref_date", days[0]!).lte("ref_date", days[6]!),
    supabase.from("btm_blocks").select("id, day").eq("user_id", uid).gte("day", days[0]!).lte("day", days[6]!),
  ]);
  if (w.error) throw w.error;
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  const dayPrios = overlayPrios(uid, (p.data ?? []) as Priority[], "day", days);
  const blockIds = new Map(((b.data ?? []) as { id: string; day: string }[]).map((x) => [x.id, x.day]));
  for (const op of myOps(uid)) {
    if (op.t === "block" && days.includes(op.row.day)) blockIds.set(op.row.id, op.row.day);
    if (op.t === "block-del") blockIds.delete(op.id);
  }
  return {
    monday,
    priorities: overlayPrios(uid, (w.data ?? []) as Priority[], "week", [monday]),
    days: days.map((day) => ({
      day,
      priorities: dayPrios.filter((x) => x.ref_date === day && (x.text.trim() || x.minutes)),
      blocks: [...blockIds.values()].filter((d) => d === day).length,
    })),
  };
}

/** Dates with saved or pending content. Throws on read errors (so the UI can show/retry). */
export async function fetchSavedDates(uid: string): Promise<string[]> {
  const [d, p, b] = await Promise.all([
    supabase.from("btm_days").select("day").eq("user_id", uid).neq("follow_up", ""),
    supabase.from("btm_priorities").select("ref_date").eq("user_id", uid).eq("scope", "day"),
    supabase.from("btm_blocks").select("day").eq("user_id", uid),
  ]);
  if (d.error) throw d.error;
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  const s = new Set<string>();
  (d.data as { day: string }[] | null)?.forEach((x) => s.add(x.day));
  (p.data as { ref_date: string }[] | null)?.forEach((x) => s.add(x.ref_date));
  (b.data as { day: string }[] | null)?.forEach((x) => s.add(x.day));
  for (const op of myOps(uid)) {
    if (op.t === "prio" && op.row.scope === "day" && (op.row.text.trim() || op.row.minutes)) s.add(op.row.ref_date);
    if (op.t === "day" && op.follow_up.trim()) s.add(op.day);
    if (op.t === "block") s.add(op.row.day);
  }
  return [...s].sort().reverse();
}

export const dayQK = (uid: string, day: string) => ["btm", uid, "day", day] as const;
export const weekQK = (uid: string, m: string) => ["btm", uid, "week", m] as const;
export const datesQK = (uid: string) => ["btm", uid, "dates"] as const;

export const useDayPlan = (uid: string, day: string) => useQuery({ queryKey: dayQK(uid, day), queryFn: () => fetchDay(uid, day) });
export const useWeekPlan = (uid: string, m: string) => useQuery({ queryKey: weekQK(uid, m), queryFn: () => fetchWeek(uid, m) });
export const useSavedDates = (uid: string) => useQuery({ queryKey: datesQK(uid), queryFn: () => fetchSavedDates(uid) });

/** Refresh lists only after the server confirmed a write. */
export function useBtmSync() {
  const qc = useQueryClient();
  useEffect(
    () =>
      onBtmSaved((uid) => {
        void qc.invalidateQueries({ queryKey: datesQK(uid) });
        void qc.invalidateQueries({ queryKey: ["btm", uid, "week"] });
      }),
    [qc],
  );
}

/** Every mutator receives the full identity (user/date/scope/slot) captured at edit time. */
export function useBtmMutations(uid: string) {
  const qc = useQueryClient();
  const savePriority = useCallback(
    (row: Priority) => {
      if (uid !== currentUser) return;
      if (row.position < 1 || row.position > MAX_PRIORITIES) return;
      if (row.minutes != null && !(Number.isInteger(row.minutes) && row.minutes > 0)) return;
      const upd = <T extends { priorities: Priority[] }>(o: T | undefined) =>
        o ? { ...o, priorities: [...o.priorities.filter((p) => p.position !== row.position), row] } : o;
      if (row.scope === "day") qc.setQueryData<DayPlan>(dayQK(uid, row.ref_date), upd);
      else qc.setQueryData<WeekPlan>(weekQK(uid, row.ref_date), upd);
      enqueue(prioKey(row.scope, row.ref_date, row.position), { t: "prio", row });
    },
    [qc, uid],
  );
  const saveFollowUp = useCallback(
    (day: string, follow_up: string) => {
      if (uid !== currentUser) return;
      qc.setQueryData<DayPlan>(dayQK(uid, day), (o) => (o ? { ...o, follow_up } : o));
      enqueue(dayKey(day), { t: "day", day, follow_up });
    },
    [qc, uid],
  );
  const saveBlock = useCallback(
    (row: Block) => {
      if (uid !== currentUser) return;
      if (!enqueue(blockKey(row.id), { t: "block", row })) return;
      qc.setQueryData<DayPlan>(dayQK(uid, row.day), (o) =>
        o
          ? { ...o, blocks: [...o.blocks.filter((b) => b.id !== row.id), row].sort((x, y) => x.start_time.localeCompare(y.start_time)) }
          : o,
      );
    },
    [qc, uid],
  );
  const deleteBlock = useCallback(
    (id: string, day: string) => {
      if (uid !== currentUser) return;
      enqueue(blockKey(id), { t: "block-del", id, day });
      qc.setQueryData<DayPlan>(dayQK(uid, day), (o) => (o ? { ...o, blocks: o.blocks.filter((b) => b.id !== id) } : o));
    },
    [qc, uid],
  );
  return { savePriority, saveFollowUp, saveBlock, deleteBlock };
}
