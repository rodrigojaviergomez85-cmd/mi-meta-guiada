import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Idea = Tables<"ideas">;
export type IdeaCategory = "personal" | "e4kids" | "e4cc" | "otros";
export type IdeaPatch = Partial<Pick<Idea, "text" | "done" | "category" | "idea_date">>;

export const CATEGORIES: { id: IdeaCategory; name: string; color: string }[] = [
  { id: "personal", name: "Personal", color: "var(--personal)" },
  { id: "e4kids", name: "E4Kids", color: "var(--e4kids)" },
  { id: "e4cc", name: "E4CC", color: "var(--e4cc)" },
  { id: "otros", name: "Otros", color: "var(--muted-foreground)" },
];
export const categoryInfo = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[3]!;

export const ideasKey = (uid: string) => ["ideas", uid] as const;

// Pending edits are kept on the device per user until the database confirms them.
const storageKey = (uid: string) => `mi411-ideas-pending-v1:${uid}`;
export function readPending(uid: string): Record<string, IdeaPatch> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(uid)) || "{}");
  } catch {
    return {};
  }
}
function writePending(uid: string, v: Record<string, IdeaPatch>) {
  try {
    if (Object.keys(v).length) localStorage.setItem(storageKey(uid), JSON.stringify(v));
    else localStorage.removeItem(storageKey(uid));
  } catch {
    /* ignore */
  }
}
export function persistPending(uid: string, id: string, patch: IdeaPatch) {
  const v = readPending(uid);
  v[id] = { ...v[id], ...patch };
  writePending(uid, v);
}
function clearPending(uid: string, id: string, sent: IdeaPatch) {
  const v = readPending(uid);
  const cur = v[id];
  if (!cur) return;
  for (const k of Object.keys(sent) as (keyof IdeaPatch)[]) if (cur[k] === sent[k]) delete cur[k];
  if (!Object.keys(cur).length) delete v[id];
  writePending(uid, v);
}
export function dropPending(uid: string, id: string) {
  const v = readPending(uid);
  delete v[id];
  writePending(uid, v);
}

async function assertUser(uid: string) {
  const { data } = await supabase.auth.getUser();
  if (data.user?.id !== uid) throw new Error("La cuenta activa cambió.");
}

export async function fetchIdeas(uid: string): Promise<Idea[]> {
  const { data, error } = await supabase.from("ideas").select("*").eq("user_id", uid);
  if (error) throw error;
  const p = readPending(uid);
  return (data ?? []).map((i) => (p[i.id] ? { ...i, ...p[i.id] } : i));
}

export async function saveIdea(uid: string, id: string, patch: IdeaPatch) {
  await assertUser(uid);
  const { error } = await supabase.from("ideas").update(patch).eq("id", id).eq("user_id", uid);
  if (error) throw error;
  clearPending(uid, id, patch);
}

export async function addIdea(uid: string, category: IdeaCategory, idea_date: string) {
  await assertUser(uid);
  const { data, error } = await supabase.from("ideas").insert({ user_id: uid, category, idea_date }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteIdea(uid: string, id: string) {
  await assertUser(uid);
  const { error } = await supabase.from("ideas").delete().eq("id", id).eq("user_id", uid);
  if (error) throw error;
  dropPending(uid, id);
}

/** Sorts a copy: by date (newest first) or by category order, then date. */
export function sortIdeas(list: Idea[], by: "date" | "category") {
  const order = (c: string) => CATEGORIES.findIndex((x) => x.id === c);
  return [...list].sort((a, b) => {
    if (by === "category" && a.category !== b.category) return order(a.category) - order(b.category);
    return b.idea_date.localeCompare(a.idea_date) || b.created_at.localeCompare(a.created_at);
  });
}
