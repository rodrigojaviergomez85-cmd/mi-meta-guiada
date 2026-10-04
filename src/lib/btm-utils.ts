// Pure helpers for the BTM planner (no network) — unit-tested.

export const MAX_PRIORITIES = 6;
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];
const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** Local calendar date -> "YYYY-MM-DD" (never via toISOString, which shifts to UTC). */
export function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** "YYYY-MM-DD" -> local Date at midnight. */
export function fromKey(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
export function isDateKey(k: unknown): k is string {
  if (typeof k !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  return toKey(fromKey(k)) === k;
}
export function addDaysKey(k: string, n: number) {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
export function mondayKey(k: string) {
  const d = fromKey(k);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return toKey(d);
}
export function todayKey() {
  return toKey(new Date());
}
export function weekDays(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}
export function dayName(k: string) {
  return DAY_NAMES[(fromKey(k).getDay() + 6) % 7]!;
}
export function longDate(k: string) {
  const d = fromKey(k);
  return `${dayName(k)} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function shortDate(k: string) {
  const d = fromKey(k);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatMinutes(m: number) {
  if (!m) return "0 min";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}
export function durationLabel(m: number) {
  if (m < 60) return `${m} min`;
  return `${+(m / 60).toFixed(2)}h`;
}
/** Valid custom duration: positive integer minutes, max one day. */
export function parseMinutes(v: string): number | null {
  if (!/^\d+$/.test(v.trim())) return null;
  const n = Number(v);
  return n > 0 && n <= 1440 ? n : null;
}
export function totalMinutes(items: { minutes: number | null }[]) {
  return items.reduce((s, p) => s + (p.minutes ?? 0), 0);
}

/** "HH:MM" (or "HH:MM:SS") -> minutes since midnight, or null. */
export function timeToMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}
export function blockError(start: string, end: string): string | null {
  const a = timeToMin(start);
  const b = timeToMin(end);
  if (a == null || b == null) return "Hora inválida";
  if (b <= a) return "La hora final debe ser después del inicio";
  return null;
}
export const hhmm = (t: string) => t.slice(0, 5);

// Queue keys embed the full identity (scope + date + slot), so an edit always lands on the date where it was typed.
export const prioKey = (scope: "day" | "week", ref: string, pos: number) => `p|${scope}|${ref}|${pos}`;
export const dayKey = (day: string) => `d|${day}`;
export const blockKey = (id: string) => `b|${id}`;
