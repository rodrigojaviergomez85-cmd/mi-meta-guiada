import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  blockError,
  blockKey,
  dayKey,
  fromKey,
  isDateKey,
  mondayKey,
  parseMinutes,
  prioKey,
  toKey,
  totalMinutes,
  weekDays,
} from "./btm-utils";

describe("local calendar dates", () => {
  it("round-trips without UTC drift (late-night local time)", () => {
    const late = new Date(2026, 9, 4, 23, 30); // 4 oct 23:30 local
    expect(toKey(late)).toBe("2026-10-04");
    expect(toKey(fromKey("2026-10-04"))).toBe("2026-10-04");
  });
  it("finds Monday and full week (Mon→Sun)", () => {
    expect(mondayKey("2026-10-04")).toBe("2026-09-28"); // Sunday belongs to previous Monday
    expect(mondayKey("2026-10-05")).toBe("2026-10-05");
    expect(weekDays("2026-09-28")).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
  });
  it("adds days across month/year boundaries", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("validates date keys", () => {
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("abc")).toBe(false);
  });
});

describe("durations", () => {
  it("accepts only positive integer minutes up to 1440", () => {
    expect(parseMinutes("25")).toBe(25);
    expect(parseMinutes("0")).toBeNull();
    expect(parseMinutes("-5")).toBeNull();
    expect(parseMinutes("1.5")).toBeNull();
    expect(parseMinutes("1441")).toBeNull();
  });
  it("sums totals ignoring empty", () => {
    expect(totalMinutes([{ minutes: 60 }, { minutes: null }, { minutes: 120 }])).toBe(180);
  });
});

describe("agenda blocks", () => {
  it("requires end after start", () => {
    expect(blockError("07:00", "07:30")).toBeNull();
    expect(blockError("09:00", "07:30")).not.toBeNull();
    expect(blockError("07:00", "07:00")).not.toBeNull();
    expect(blockError("", "07:00")).not.toBeNull();
  });
});

describe("queue identity", () => {
  it("keys differ by date so fast date changes never collide", () => {
    expect(prioKey("day", "2026-10-04", 1)).not.toBe(prioKey("day", "2026-10-05", 1));
    expect(prioKey("day", "2026-09-28", 1)).not.toBe(prioKey("week", "2026-09-28", 1));
    expect(dayKey("2026-10-04")).not.toBe(dayKey("2026-10-05"));
    expect(blockKey("a")).not.toBe(blockKey("b"));
  });
});
