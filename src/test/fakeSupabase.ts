// In-memory fake of the Supabase client for BTM tests. Never talks to the real database.
export type Write = { table: string; kind: "upsert" | "delete"; payload: unknown; filters: unknown[][] };
type Res = { data: unknown; error: { code?: string; message: string } | null };

export const fake = {
  writes: [] as Write[],
  rows: {} as Record<string, Record<string, unknown>[]>,
  /** Override to control write results (return a promise to hold a write "in flight"). */
  onWrite: (_w: Write): Res | Promise<Res> => ({ data: null, error: null }),
  reset() {
    this.writes = [];
    this.rows = {};
    this.onWrite = () => ({ data: null, error: null });
  },
};

function builder(table: string) {
  const filters: unknown[][] = [];
  let kind: "select" | "upsert" | "delete" = "select";
  let payload: unknown;
  let single = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  for (const m of ["select", "eq", "neq", "gte", "lte"]) {
    b[m] = (...a: unknown[]) => {
      if (m !== "select") filters.push([m, ...a]);
      return b;
    };
  }
  b.upsert = (p: unknown) => {
    kind = "upsert";
    payload = p;
    return b;
  };
  b.delete = () => {
    kind = "delete";
    return b;
  };
  b.maybeSingle = () => {
    single = true;
    return b;
  };
  b.then = (res: (r: Res) => unknown, rej: (e: unknown) => unknown) => {
    let p: Promise<Res>;
    if (kind === "select") {
      const rows = (fake.rows[table] ?? []).filter((r) =>
        filters.every(([op, col, val]) => {
          const v = r[col as string];
          if (op === "eq") return v === val;
          if (op === "neq") return v !== val;
          if (op === "gte") return String(v) >= String(val);
          if (op === "lte") return String(v) <= String(val);
          return true;
        }),
      );
      p = Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null });
    } else {
      const w: Write = { table, kind, payload, filters };
      fake.writes.push(w);
      p = Promise.resolve(fake.onWrite(w));
    }
    return p.then(res, rej);
  };
  return b;
}

export const supabase = {
  from: (t: string) => builder(t),
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
