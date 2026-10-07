// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = [
  { id: "i1", snapshot_id: "s1", company: "e4kids", position: 1, text: "Primero", updated_at: "now" },
];
let currentUser = "u1";
const writes: Array<{ kind: string; value?: string | undefined; id?: string | undefined }> = [];

function queryBuilder() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: rows, error: null }),
    update: (value: { text: string }) => {
      writes.push({ kind: "update", value: value.text });
      return builder;
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: currentUser } } }) },
    from: () => queryBuilder(),
    rpc: async (name: string, args: { _id?: string }) => {
      writes.push({ kind: name, id: args._id });
      return name === "add_company_issue_item"
        ? { data: { id: "i2", snapshot_id: "s1", company: "e4kids", position: 2, text: "", updated_at: "now" }, error: null }
        : { data: null, error: null };
    },
  },
}));

import {
  addCompanyIssueItem,
  deleteCompanyIssueItem,
  fetchCompanyIssueItems,
  persistCompanyIssueItem,
  saveCompanyIssueItem,
} from "./company-issues";

beforeEach(() => {
  localStorage.clear();
  writes.length = 0;
  currentUser = "u1";
});

describe("company issue list", () => {
  it("overlays only the active user's pending text", async () => {
    persistCompanyIssueItem("u1", "i1", "Pendiente de uno");
    persistCompanyIssueItem("u2", "i1", "Pendiente de dos");
    expect((await fetchCompanyIssueItems("u1", "s1", "e4kids"))[0]?.text).toBe("Pendiente de uno");
    expect((await fetchCompanyIssueItems("u2", "s1", "e4kids"))[0]?.text).toBe("Pendiente de dos");
  });

  it("keeps a local edit when another account becomes active", async () => {
    persistCompanyIssueItem("u1", "i1", "No perder");
    currentUser = "u2";
    await expect(saveCompanyIssueItem("u1", rows[0] as never, "No perder")).rejects.toThrow("cuenta activa cambió");
    expect(writes).toHaveLength(0);
    expect((await fetchCompanyIssueItems("u1", "s1", "e4kids"))[0]?.text).toBe("No perder");
  });

  it("adds and deletes list rows through the list RPCs", async () => {
    const added = await addCompanyIssueItem("u1", "s1", "e4kids");
    expect(added.position).toBe(2);
    await deleteCompanyIssueItem("u1", "i1");
    expect(writes.map((entry) => entry.kind)).toEqual([
      "add_company_issue_item",
      "delete_company_issue_item",
    ]);
  });
});
