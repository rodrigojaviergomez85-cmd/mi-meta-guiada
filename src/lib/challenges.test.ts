import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  challenges: [{ id: "first", habit: "Leer", area: "personal", start_date: "2026-10-19" }],
  days: [{ challenge_id: "first", day_number: 1, checked_on: "2026-10-19", comment: "Nota original" }],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    let ids: string[] = [];
    const query = {
      select: () => query,
      eq: () => query,
      order: async () => ({ data: [...db.challenges], error: null }),
      in: (_col: string, values: string[]) => { ids = values; return query; },
      insert: (payload: { habit: string; start_date: string }) => {
        db.challenges.push({ id: `new-${db.challenges.length}`, area: "personal", ...payload });
        return query;
      },
      single: async () => ({ data: db.challenges.at(-1), error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({
        data: table === "habit_challenge_days" ? db.days.filter((d) => ids.includes(d.challenge_id)) : db.challenges,
        error: null,
      }).then(resolve),
    };
    return query;
  } },
}));

import { challengeDate, createChallenge, daysForChallenge, loadChallenges } from "./challenges";

describe("simultaneous habit challenges", () => {
  it("dates all 66 days consecutively from the chosen start date", () => {
    expect(challengeDate("2026-10-19", 1)).toBe("2026-10-19");
    expect(challengeDate("2026-10-19", 2)).toBe("2026-10-20");
    expect(challengeDate("2026-10-19", 66)).toBe("2026-12-23");
    expect(challengeDate("2026-12-31", 2)).toBe("2027-01-01");
    expect(challengeDate("2028-02-28", 2)).toBe("2028-02-29");
    expect(challengeDate("2026-10-20", 66)).toBe("2026-12-24");
  });
  beforeEach(() => {
    db.challenges = [{ id: "first", habit: "Leer", area: "personal", start_date: "2026-10-19" }];
    db.days = [{ challenge_id: "first", day_number: 1, checked_on: "2026-10-19", comment: "Nota original" }];
  });
  it("creates multiple active challenges without replacing the existing habit or progress", async () => {
    for (let i = 0; i < 8; i++) await createChallenge();
    const result = await loadChallenges();
    expect(result.challenges).toHaveLength(9);
    expect(result.challenges[0]?.habit).toBe("Leer");
    expect(result.days[0]?.comment).toBe("Nota original");
    expect(new Set(result.challenges.map((c) => c.id)).size).toBe(9);
  });
  it("keeps dates, comments and counts independent when selecting another challenge", () => {
    const days = [...db.days, { challenge_id: "second", day_number: 1, checked_on: "2026-10-20", comment: "Otra nota" }];
    expect(daysForChallenge(days, "first")).toEqual(db.days);
    expect(daysForChallenge(days, "second")).toEqual([days[1]]);
    expect(daysForChallenge(days, "new")).toEqual([]);
  });
});