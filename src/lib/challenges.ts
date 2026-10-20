import { supabase } from "@/integrations/supabase/client";
import { addDaysKey, todayKey } from "@/lib/btm-utils";

export type Challenge = { id: string; habit: string; area: string; start_date: string };
export type ChallengeDay = { challenge_id: string; day_number: number; checked_on: string; comment: string };

export async function loadChallenges() {
  const { data, error } = await supabase.from("habit_challenges")
    .select("id, habit, area, start_date").eq("active", true).order("created_at");
  if (error) throw error;
  const challenges: Challenge[] = data ?? [];
  if (!challenges.length) return { challenges, days: [] as ChallengeDay[] };
  const { data: days, error: dayError } = await supabase.from("habit_challenge_days")
    .select("challenge_id, day_number, checked_on, comment").in("challenge_id", challenges.map((c) => c.id));
  if (dayError) throw dayError;
  return { challenges, days: (days ?? []) as ChallengeDay[] };
}

export async function createChallenge() {
  const { data, error } = await supabase.from("habit_challenges")
    .insert({ habit: "", start_date: todayKey() }).select("id, habit, area, start_date").single();
  if (error) throw error;
  return data as Challenge;
}

export function daysForChallenge(days: ChallengeDay[], id: string) {
  return days.filter((day) => day.challenge_id === id);
}

/** Day one is the start date; subsequent cells follow the local calendar. */
export function challengeDate(startDate: string, dayNumber: number) {
  return addDaysKey(startDate, dayNumber - 1);
}