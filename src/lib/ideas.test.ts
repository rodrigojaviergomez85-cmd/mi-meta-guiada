import { describe, expect, it } from "vitest";
import { sortIdeas, type Idea } from "./ideas";

const mk = (id: string, category: string, idea_date: string) =>
  ({ id, category, idea_date, created_at: "2026-10-07T00:00:00Z" }) as Idea;
const rows = [mk("a", "otros", "2026-10-01"), mk("b", "personal", "2026-09-01"), mk("c", "e4cc", "2026-10-05"), mk("d", "personal", "2026-10-06")];

describe("sortIdeas", () => {
  it("by date: newest first", () => {
    expect(sortIdeas(rows, "date").map((r) => r.id)).toEqual(["d", "c", "a", "b"]);
  });
  it("by category: Personal, E4Kids, E4CC, Otros, then newest", () => {
    expect(sortIdeas(rows, "category").map((r) => r.id)).toEqual(["d", "b", "c", "a"]);
  });
});
