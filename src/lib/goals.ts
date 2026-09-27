import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Company = Database["public"]["Enums"]["goal_company"];
export type Level = Database["public"]["Enums"]["goal_level"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Snapshot = Database["public"]["Tables"]["snapshots"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const COMPANIES: { id: Company; name: string; color: string }[] = [
  { id: "personal", name: "Personal", color: "var(--personal)" },
  { id: "e4cc", name: "E4CC", color: "var(--e4cc)" },
  { id: "e4kids", name: "E4Kids", color: "var(--e4kids)" },
];
export const LEVELS: Level[] = ["annual", "monthly", "weekly"];

export function companyInfo(id: string) {
  return COMPANIES.find((c) => c.id === id);
}

export function levelTitle(level: Level, s: Snapshot) {
  if (level === "annual") return `Metas anuales — ${s.annual_label}`;
  if (level === "monthly") return `Metas mensuales — ${s.month_label}`;
  return `Metas semanales — ${s.week_label}`;
}

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEPT", "OCT", "NOV", "DIC"];
export function todayLabel(d = new Date()) {
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}
export function currentMonthLabel(d = new Date()) {
  return MONTHS[d.getMonth()];
}
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type SnapshotData = { snapshot: Snapshot; goals: Goal[] };

// ---------- Offline-tolerant save queue ----------
type Patch = { text?: string; done?: boolean };
const KEY = "mi411-pending-v1";
type Status = "idle" | "saving" | "saved" | "error";
let pending: Record<string, Patch> = {};
let status: Status = "idle";
const listeners = new Set<(s: Status) => void>();
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let errorToastShown = false;

function load() {
  if (typeof window === "undefined") return;
  try {
    pending = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    pending = {};
  }
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}
function setStatus(s: Status) {
  status = s;
  listeners.forEach((l) => l(s));
}
export function subscribeStatus(fn: (s: Status) => void) {
  listeners.add(fn);
  fn(status);
  return () => void listeners.delete(fn);
}

export function applyPending(goals: Goal[]): Goal[] {
  return goals.map((g) => (pending[g.id] ? { ...g, ...pending[g.id] } : g));
}

export function queueSave(id: string, patch: Patch) {
  pending[id] = { ...pending[id], ...patch };
  persist();
  void flush();
}

export async function flush() {
  if (flushing) return;
  const ids = Object.keys(pending);
  if (!ids.length) return;
  flushing = true;
  setStatus("saving");
  let failed = false;
  for (const id of ids) {
    const p = pending[id];
    try {
      const { error } = await supabase.from("goals").update(p).eq("id", id);
      if (error) throw error;
      if (pending[id] === p) delete pending[id];
    } catch {
      failed = true;
    }
  }
  persist();
  flushing = false;
  if (failed) {
    setStatus("error");
    if (!errorToastShown) {
      errorToastShown = true;
      toast.error("No se pudo guardar. Tus cambios están guardados en este dispositivo y se reintentarán.");
    }
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void flush(), 5000);
  } else if (Object.keys(pending).length) {
    void flush();
  } else {
    errorToastShown = false;
    setStatus("saved");
  }
}

if (typeof window !== "undefined") {
  load();
  window.addEventListener("online", () => void flush());
  setTimeout(() => void flush(), 1000);
}

// ---------- Queries ----------
export async function fetchCurrent(): Promise<SnapshotData | null> {
  await supabase.rpc("seed_if_empty");
  const { data: snap, error } = await supabase
    .from("snapshots")
    .select("*")
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!snap) return null;
  return fetchSnapshotById(snap.id);
}

export async function fetchSnapshotById(id: string): Promise<SnapshotData> {
  const [{ data: snapshot, error: e1 }, { data: goals, error: e2 }] = await Promise.all([
    supabase.from("snapshots").select("*").eq("id", id).single(),
    supabase.from("goals").select("*").eq("snapshot_id", id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { snapshot: snapshot!, goals: applyPending(goals ?? []) };
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  return data;
}

export function goalsFor(goals: Goal[], company: Company, level: Level) {
  return goals
    .filter((g) => g.company === company && g.level === level)
    .sort((a, b) => a.position - b.position);
}
