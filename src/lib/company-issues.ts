import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Company } from "./goals";

export type CompanyIssueItem = Tables<"company_issue_items">;

const STORAGE_PREFIX = "mi411-company-issue-items-pending-v1:";

export const companyIssueKey = (userId: string, snapshotId: string, company: Company) =>
  ["company-issue-items", userId, snapshotId, company] as const;

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function readPending(userId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writePending(userId: string, values: Record<string, string>) {
  localStorage.setItem(storageKey(userId), JSON.stringify(values));
}

export function persistCompanyIssueItem(userId: string, id: string, text: string) {
  const values = readPending(userId);
  values[id] = text;
  writePending(userId, values);
}

function clearPendingCompanyIssueItem(userId: string, id: string, text: string) {
  const values = readPending(userId);
  if (values[id] !== text) return;
  delete values[id];
  writePending(userId, values);
}

async function assertCurrentUser(userId: string) {
  const { data } = await supabase.auth.getUser();
  if (data.user?.id !== userId) {
    throw new Error("La cuenta activa cambió. El cambio sigue pendiente en este dispositivo.");
  }
}

export async function fetchCompanyIssueItems(
  userId: string,
  snapshotId: string,
  company: Company,
  includePending = true,
) {
  const { data, error } = await supabase
    .from("company_issue_items")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .eq("company", company)
    .order("position");
  if (error) throw error;
  const pending = includePending ? readPending(userId) : {};
  return (data ?? []).map((item) => ({ ...item, text: pending[item.id] ?? item.text }));
}

export async function saveCompanyIssueItem(userId: string, item: CompanyIssueItem, text: string) {
  await assertCurrentUser(userId);
  const { error } = await supabase
    .from("company_issue_items")
    .update({ text })
    .eq("id", item.id)
    .eq("snapshot_id", item.snapshot_id);
  if (error) throw error;
  clearPendingCompanyIssueItem(userId, item.id, text);
}

export async function addCompanyIssueItem(userId: string, snapshotId: string, company: Company) {
  await assertCurrentUser(userId);
  const { data, error } = await supabase.rpc("add_company_issue_item", {
    _snapshot_id: snapshotId,
    _company: company,
  });
  if (error) throw error;
  return data;
}

export async function deleteCompanyIssueItem(userId: string, id: string) {
  await assertCurrentUser(userId);
  const { error } = await supabase.rpc("delete_company_issue_item", { _id: id });
  if (error) throw error;
}