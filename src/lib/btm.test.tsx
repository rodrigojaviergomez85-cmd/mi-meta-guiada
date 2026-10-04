// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => import("@/test/fakeSupabase"));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { fake } from "@/test/fakeSupabase";
import {
  __resetBtm,
  dayQK,
  fetchDay,
  fetchSavedDates,
  flushBtm,
  getPending,
  onBtmSaved,
  setBtmUser,
  storageKey,
  subscribeBtm,
  useBtmMutations,
  useDayPlan,
  type BtmStatus,
  type DayPlan,
} from "./btm";
import { Agenda, PriorityList } from "@/components/btm/BtmFields";

const A = "user-a";
const B = "user-b";
const D1 = "2026-10-04";
const D2 = "2026-10-05";
const empty = (day: string): DayPlan => ({ day, follow_up: "", priorities: [], blocks: [] });

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fake.reset();
  __resetBtm();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Real UI pieces wired to the real hooks, the real queue and the fake API. */
function DayHarness({ uid, day }: { uid: string; day: string; qc: QueryClient }) {
  const m = useBtmMutations(uid);
  const data = useDayPlan(uid, day).data!; // subscribed to the cache, as in the app
  return (
    <div key={day}>
      <PriorityList scope="day" refDate={day} priorities={data.priorities} onSave={m.savePriority} />
      <Agenda day={day} blocks={data.blocks} onSave={m.saveBlock} onDelete={m.deleteBlock} />
      <button onClick={() => m.savePriority({ ...(data.priorities.find((p) => p.position === 1) ?? { scope: "day", ref_date: day, position: 1, text: "", done: false, minutes: null }), minutes: 60 })}>
        set60
      </button>
    </div>
  );
}

describe("BTM queue + UI", () => {
  it("rapid date change keeps text and duration on the original date", async () => {
    setBtmUser(A);
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), empty(D1));
    qc.setQueryData(dayQK(A, D2), empty(D2));
    const { rerender } = render(<DayHarness uid={A} day={D1} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.click(screen.getByText("set60")); // duration chosen
    await tick(10); // let the cache update reach the UI
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "Recepción" } });
    // switch date well before the 800 ms network debounce
    await tick(100);
    rerender(<DayHarness uid={A} day={D2} qc={qc} />);
    expect((screen.getByLabelText("Prioridad A1") as HTMLTextAreaElement).value).toBe("");
    await tick(1000);
    const ups = fake.writes.filter((w) => w.table === "btm_priorities");
    expect(ups).toHaveLength(1);
    expect(ups[0]!.payload).toMatchObject({ user_id: A, ref_date: D1, position: 1, text: "Recepción", minutes: 60 });
  });

  it("edit is durable immediately (tab close) and recovered after reload", async () => {
    setBtmUser(A);
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), empty(D1));
    render(<DayHarness uid={A} day={D1} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "Clase" } });
    // No timers advanced: already in local storage, nothing sent yet
    expect(JSON.parse(localStorage.getItem(storageKey(A))!)).toHaveProperty(`p|day|${D1}|1`);
    expect(fake.writes).toHaveLength(0);
    cleanup();
    __resetBtm(); // simulated reload
    setBtmUser(A);
    const plan = await fetchDay(A, D1);
    expect(plan.priorities[0]).toMatchObject({ text: "Clase" });
    await tick(10);
    expect(fake.writes[0]!.payload).toMatchObject({ user_id: A, text: "Clase" });
  });

  it("account switch never sends or shows another user's pending edits", async () => {
    setBtmUser(A);
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), empty(D1));
    render(<DayHarness uid={A} day={D1} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "Secreto de A" } });
    cleanup();
    setBtmUser(B); // before the debounce fires
    await tick(2000);
    expect(fake.writes).toHaveLength(0);
    expect(Object.keys(getPending())).toHaveLength(0);
    expect((await fetchDay(B, D1)).priorities).toHaveLength(0);
    expect(await fetchSavedDates(B)).toEqual([]);
    // the mutator bound to A refuses to write while B is signed in
    // back to A: A's edit is sent with A's id
    setBtmUser(A);
    await tick(10);
    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]!.payload).toMatchObject({ user_id: A, text: "Secreto de A" });
  });

  it("legacy un-owned pending storage is never sent", async () => {
    localStorage.setItem("mi411-btm-pending-v1", JSON.stringify({ x: { t: "day", day: D1, follow_up: "viejo" } }));
    localStorage.setItem(storageKey(A), JSON.stringify({ y: { t: "day", day: D1, follow_up: "sin dueño" } }));
    setBtmUser(A);
    await tick(2000);
    expect(fake.writes).toHaveLength(0);
  });

  it("edit + delete before 800 ms does not resurrect the block", async () => {
    setBtmUser(A);
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), {
      ...empty(D1),
      blocks: [{ id: "b1", day: D1, start_time: "07:00", end_time: "07:30", activity: "BTM" }],
    });
    const { rerender } = render(<DayHarness uid={A} day={D1} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.change(screen.getByLabelText("Actividad"), { target: { value: "BTM Teams y correo" } });
    await tick(200);
    fireEvent.click(screen.getByLabelText("Borrar bloque"));
    rerender(<DayHarness uid={A} day={D1} qc={qc} />);
    expect(screen.queryByLabelText("Actividad")).toBeNull();
    await tick(2000);
    const bw = fake.writes.filter((w) => w.table === "btm_blocks");
    expect(bw.map((w) => w.kind)).toEqual(["delete"]);
    expect(bw[0]!.filters).toContainEqual(["eq", "user_id", A]);
  });

  it("delete wins over an upsert already in flight", async () => {
    setBtmUser(A);
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), empty(D1));
    let release!: () => void;
    fake.onWrite = (w) =>
      w.kind === "upsert" ? new Promise((r) => (release = () => r({ data: null, error: null }))) : { data: null, error: null };
    const { result } = await import("@testing-library/react").then(({ renderHook }) =>
      renderHook(() => useBtmMutations(A), { wrapper: wrap(qc) }),
    );
    const blk = { id: "b2", day: D1, start_time: "08:00", end_time: "09:00", activity: "Recepción" };
    act(() => result.current.saveBlock(blk));
    await tick(900); // upsert now in flight
    act(() => result.current.deleteBlock("b2", D1));
    act(() => result.current.saveBlock({ ...blk, activity: "otra vez" })); // late edit must be ignored
    release();
    await tick(2000);
    const kinds = fake.writes.map((w) => w.kind);
    expect(kinds).toEqual(["upsert", "delete"]);
    expect(Object.keys(getPending())).toHaveLength(0);
  });

  it("network error never shows Guardado and keeps edits", async () => {
    setBtmUser(A);
    const seen: BtmStatus[] = [];
    subscribeBtm((s) => seen.push(s));
    fake.onWrite = () => ({ data: null, error: { message: "Failed to fetch" } });
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), empty(D1));
    render(<DayHarness uid={A} day={D1} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "Liderazgo" } });
    expect(seen.at(-1)).toBe("pending");
    await tick(12000); // first try + retries
    expect(seen).not.toContain("saved");
    expect(seen.at(-1)).toBe("error");
    expect(Object.keys(getPending())).toHaveLength(1);
  });

  it("constraint rejection keeps the op (recoverable) with a truthful error", async () => {
    setBtmUser(A);
    const seen: BtmStatus[] = [];
    subscribeBtm((s) => seen.push(s));
    fake.onWrite = () => ({ data: null, error: { code: "23514", message: "check" } });
    const qc = newQc();
    qc.setQueryData(dayQK(A, D1), empty(D1));
    render(<DayHarness uid={A} day={D1} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "x" } });
    await tick(1000);
    const op = getPending()[`p|day|${D1}|1`];
    expect(op?.rejected).toBe(true);
    expect(JSON.parse(localStorage.getItem(storageKey(A))!)[`p|day|${D1}|1`].rejected).toBe(true);
    expect(seen).not.toContain("saved");
    expect(seen.at(-1)).toBe("error");
    const n = fake.writes.length;
    await tick(10000);
    expect(fake.writes.length).toBe(n); // not retried in a loop
    // fixing it replaces the rejected op and saves
    fake.onWrite = () => ({ data: null, error: null });
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "xy" } });
    await tick(1000);
    expect(seen.at(-1)).toBe("saved");
  });

  it("saved date shows while pending and lists refresh only after server success", async () => {
    setBtmUser(A);
    let release!: () => void;
    fake.onWrite = () => new Promise((r) => (release = () => r({ data: null, error: null })));
    const saved = vi.fn();
    onBtmSaved(saved);
    const qc = newQc();
    qc.setQueryData(dayQK(A, D2), empty(D2));
    render(<DayHarness uid={A} day={D2} qc={qc} />, { wrapper: wrap(qc) });
    fireEvent.change(screen.getByLabelText("Prioridad A1"), { target: { value: "Clase" } });
    expect(await fetchSavedDates(A)).toEqual([D2]); // pending date included
    await tick(900);
    expect(saved).not.toHaveBeenCalled(); // write still in flight
    release();
    await tick(10);
    expect(saved).toHaveBeenCalledWith(A);
    // after success the server row is the source
    fake.rows["btm_priorities"] = [{ user_id: A, scope: "day", ref_date: D2, position: 1, text: "Clase", minutes: null, done: false }];
    expect(await fetchSavedDates(A)).toEqual([D2]);
  });

  it("read errors surface instead of an empty list", async () => {
    setBtmUser(A);
    const { supabase } = await import("@/test/fakeSupabase");
    const spy = vi.spyOn(supabase, "from").mockImplementation((() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {};
      for (const m of ["select", "eq", "neq", "gte", "lte"]) b[m] = () => b;
      b.then = (r: (x: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "boom" } }).then(r);
      return b;
    }) as never);
    await expect(fetchSavedDates(A)).rejects.toBeTruthy();
    spy.mockRestore();
    void flushBtm;
  });
});
