import { supabase } from "@/integrations/supabase/client";
import type { Company } from "./goals";

const STORAGE_PREFIX = "mi411-company-issues-pending-v1:";

export const companyIssueKey = (userId: string, snapshotId: string, company: Company) =>
  ["company-issue", userId, snapshotId, company] as const;

function entryKey(snapshotId: string, company: Company) {
  return `${snapshotId}:${company}`;
}

function readPending(userId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${userId}`) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writePending(userId: string, values: Record<string, string>) {
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(values));
}

export function getPendingCompanyIssue(userId: string, snapshotId: string, company: Company) {
  return readPending(userId)[entryKey(snapshotId, company)];
}

export function persistCompanyIssue(userId: string, snapshotId: string, company: Company, body: string) {
  const values = readPending(userId);
  values[entryKey(snapshotId, company)] = body;
  writePending(userId, values);
}

export function clearPendingCompanyIssue(userId: string, snapshotId: string, company: Company, body: string) {
  const values = readPending(userId);
  const key = entryKey(snapshotId, company);
  if (values[key] !== body) return;
  delete values[key];
  writePending(userId, values);
}

export async function fetchCompanyIssue(userId: string, snapshotId: string, company: Company, includePending = true) {
  const { data, error } = await supabase
    .from("company_issues")
    .select("body")
    .eq("snapshot_id", snapshotId)
    .eq("company", company)
    .maybeSingle();
  if (error) throw error;
  return (includePending ? getPendingCompanyIssue(userId, snapshotId, company) : undefined) ?? data?.body ?? "";
}

export async function saveCompanyIssue(userId: string, snapshotId: string, company: Company, body: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.id !== userId) throw new Error("La cuenta activa cambió. La nota sigue pendiente en este dispositivo.");
  const { error } = await supabase.from("company_issues").upsert(
    { snapshot_id: snapshotId, company, body },
    { onConflict: "snapshot_id,company" },
  );
  if (error) throw error;
  clearPendingCompanyIssue(userId, snapshotId, company, body);
}