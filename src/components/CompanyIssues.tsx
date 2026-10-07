import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  companyIssueKey,
  fetchCompanyIssue,
  persistCompanyIssue,
  saveCompanyIssue,
} from "@/lib/company-issues";
import type { Company } from "@/lib/goals";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export function CompanyIssues({
  userId,
  snapshotId,
  company,
  color,
  readOnly = false,
}: {
  userId: string;
  snapshotId: string;
  company: Company;
  color: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const key = companyIssueKey(userId, snapshotId, company);
  const { data = "", isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchCompanyIssue(userId, snapshotId, company, !readOnly),
  });
  const [text, setText] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef("");

  useEffect(() => {
    setText(data);
    latest.current = data;
  }, [data]);

  const send = async (body: string) => {
    setState("saving");
    try {
      await saveCompanyIssue(userId, snapshotId, company, body);
      if (latest.current === body) setState("saved");
      await qc.invalidateQueries({ queryKey: key });
    } catch {
      setState("error");
    }
  };

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (!readOnly && state === "pending") void send(latest.current);
    },
    // The cleanup intentionally sends the latest ref, not a stale render value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const status =
    state === "saving" ? (
      <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Guardando</>
    ) : state === "error" ? (
      <><AlertCircle className="h-3.5 w-3.5" /> Pendiente — toca para reintentar</>
    ) : state === "saved" ? (
      <><Check className="h-3.5 w-3.5" /> Guardado</>
    ) : state === "pending" ? "Pendiente" : null;

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-soft">
      <div className="flex min-h-14 items-center px-4 py-3" style={{ borderLeft: `4px solid ${color}` }}>
        <h2 className="font-display text-base font-semibold">ISSUES / PRIORITIES</h2>
      </div>
      <div className="border-t px-4 pb-4 pt-3">
        {isLoading ? (
          <p className="py-3 text-sm text-muted-foreground">Cargando…</p>
        ) : readOnly ? (
          <p className="min-h-28 whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
            {text || "—"}
          </p>
        ) : (
          <Textarea
            value={text}
            rows={7}
            aria-label="Issues y prioridades"
            placeholder="Anota aquí los issues y prioridades…"
            onChange={(event) => {
              const body = event.target.value;
              latest.current = body;
              setText(body);
              setState("pending");
              persistCompanyIssue(userId, snapshotId, company, body);
              qc.setQueryData(key, body);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => void send(body), 800);
            }}
            onBlur={() => {
              clearTimeout(timer.current);
              if (state === "pending" || state === "error") void send(latest.current);
            }}
            className="min-h-44 resize-y rounded-xl bg-muted/50 text-base leading-relaxed"
          />
        )}
        {!readOnly && status && (
          <button
            type="button"
            disabled={state !== "error"}
            onClick={() => void send(latest.current)}
            className="mt-2 flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground disabled:cursor-default"
          >
            {status}
          </button>
        )}
      </div>
    </section>
  );
}