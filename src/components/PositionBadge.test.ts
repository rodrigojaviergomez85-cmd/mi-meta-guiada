import { describe, expect, it } from "vitest";
import { shiftedPosition } from "./PositionBadge";

const move = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => shiftedPosition(i + 1, from, to));

describe("reordering", () => {
  it("moving #2 to #4 shifts #3 and #4 up", () => expect(move(5, 2, 4)).toEqual([1, 4, 2, 3, 5]));
  it("moving #5 to #1 shifts everyone down", () => expect(move(5, 5, 1)).toEqual([2, 3, 4, 5, 1]));
});
