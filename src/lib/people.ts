import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Person = Database["public"]["Tables"]["people"]["Row"];
export type Comment = Database["public"]["Tables"]["goal_comments"]["Row"];

export const peopleKey = ["people"] as const;
export const commentCountsKey = (snapshotId: string) => ["commentCounts", snapshotId] as const;
export const commentsKey = (goalId: string) => ["comments", goalId] as const;

export function usePeople() {
  return useQuery({
    queryKey: peopleKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useCommentCounts(snapshotId: string) {
  return useQuery({
    queryKey: commentCountsKey(snapshotId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_comments")
        .select("goal_id, goals!inner(snapshot_id)")
        .eq("goals.snapshot_id", snapshotId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => (counts[c.goal_id] = (counts[c.goal_id] ?? 0) + 1));
      return counts;
    },
    staleTime: 30_000,
  });
}

export function useComments(goalId: string, enabled: boolean) {
  return useQuery({
    queryKey: commentsKey(goalId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_comments")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

const PALETTE = ["#e76f51", "#2a9d8f", "#e9c46a", "#8e7dbe", "#f4a261", "#457b9d", "#d62828", "#6a994e"];
export function personColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
export function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (diff === 0) return `hoy ${hm}`;
  if (diff === 1) return "ayer";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
