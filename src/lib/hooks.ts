import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  fetchCurrent,
  fetchProfile,
  fetchSnapshotById,
  queueSave,
  subscribeStatus,
  type Goal,
  type SnapshotData,
} from "./goals";

export const currentKey = ["current"] as const;
export const snapshotKey = (id: string) => ["snapshot", id] as const;

export function useCurrent() {
  return useQuery({ queryKey: currentKey, queryFn: fetchCurrent, staleTime: 30_000 });
}
export function useSnapshot(id: string) {
  return useQuery({ queryKey: snapshotKey(id), queryFn: () => fetchSnapshotById(id) });
}
export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
}

export type GoalPatch = { text?: string; done?: boolean };

export function usePatchGoal(key: readonly unknown[]) {
  const qc = useQueryClient();
  return useCallback(
    (goal: Goal, patch: GoalPatch) => {
      qc.setQueryData<SnapshotData | null>(key, (old) =>
        old ? { ...old, goals: old.goals.map((g) => (g.id === goal.id ? { ...g, ...patch } : g)) } : old,
      );
      queueSave(goal.id, patch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, JSON.stringify(key)],
  );
}

export function useSaveStatus() {
  const [s, setS] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => subscribeStatus(setS), []);
  return s;
}
