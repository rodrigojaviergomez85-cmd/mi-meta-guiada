import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  addCompanyIssueItem,
  companyIssueKey,
  deleteCompanyIssueItem,
  fetchCompanyIssueItems,
  fetchIssueCommentCounts,
  issueCommentCountsKey,
  saveCompanyIssueDate,
  persistCompanyIssueItem,
  saveCompanyIssueItem,
  type CompanyIssueItem,
} from "@/lib/company-issues";
import type { Company } from "@/lib/goals";
import { cn } from "@/lib/utils";
import { CommentThreadChip } from "./CommentsChip";
import { shortDate } from "@/lib/btm-utils";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function IssueRow({
  item,
  userId,
  readOnly,
  autoFocus,
  onDelete,
  onSaved,
  commentCount,
  countKey,
}: {
  commentCount: number;
  countKey: readonly unknown[];
  item: CompanyIssueItem;
  userId: string;
  readOnly: boolean;
  autoFocus: boolean;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [state, setState] = useState<SaveState>("idle");
  const [confirm, setConfirm] = useState(false);
  const [date, setDate] = useState(item.item_date ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(item.text);
  const stateRef = useRef<SaveState>("idle");

  const updateState = (next: SaveState) => {
    stateRef.current = next;
    setState(next);
  };

  const send = async (value: string) => {
    updateState("saving");
    try {
      await saveCompanyIssueItem(userId, item, value);
      if (latest.current === value) updateState("saved");
      onSaved();
    } catch {
      updateState("error");
    }
  };

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.max(field.scrollHeight, 44)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (!readOnly && stateRef.current === "pending") void send(latest.current);
    },
    // Cleanup sends the latest value through refs rather than a stale render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const source = { table: "issue_item_comments" as const, fk: "item_id" as const, parentId: item.id, countKey };
  const changeDate = async (v: string) => {
    if (!v) return;
    const prev = date;
    setDate(v);
    try {
      await saveCompanyIssueDate(userId, item.id, v);
      onSaved();
    } catch {
      setDate(prev);
      toast.error("No se pudo guardar la fecha.");
    }
  };

  if (readOnly) {
    return (
      <li className="flex gap-3 border-b py-3 last:border-b-0">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {item.position}
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{text || "—"}</p>
          <div className="flex flex-wrap items-center gap-2">
            {date && <span className="text-xs text-muted-foreground">{shortDate(date)}</span>}
            <CommentThreadChip source={source} title={text || "Sin texto"} count={commentCount} readOnly />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 border-b py-2 last:border-b-0">
      <span className="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {item.position}
      </span>
      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          aria-label={`Issue o prioridad ${item.position}`}
          placeholder="Escribe un issue o prioridad…"
          onChange={(event) => {
            const value = event.target.value;
            latest.current = value;
            setText(value);
            updateState("pending");
            persistCompanyIssueItem(userId, item.id, value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => void send(value), 800);
          }}
          onBlur={() => {
            clearTimeout(timer.current);
            if (stateRef.current === "pending" || stateRef.current === "error") void send(latest.current);
          }}
          className="block min-h-11 w-full resize-none overflow-hidden rounded-lg bg-transparent px-2 py-2 text-base leading-relaxed outline-none focus:bg-muted focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="button"
          disabled={state !== "error"}
          onClick={() => void send(latest.current)}
          className={cn(
            "flex h-5 items-center gap-1 px-2 text-xs text-muted-foreground disabled:cursor-default",
            state === "idle" && "invisible",
          )}
        >
          {state === "saving" && <><LoaderCircle className="h-3 w-3 animate-spin" /> Guardando</>}
          {state === "pending" && "Pendiente"}
          {state === "saved" && <><Check className="h-3 w-3" /> Guardado</>}
          {state === "error" && <><AlertCircle className="h-3 w-3" /> Error — reintentar</>}
        </button>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <input
            type="date"
            aria-label="Fecha"
            value={date}
            onChange={(e) => void changeDate(e.target.value)}
            className="min-h-9 rounded-full border border-input bg-background px-3 text-sm text-muted-foreground"
          />
          <CommentThreadChip source={source} title={text || "Sin texto"} count={commentCount} />
        </div>
      </div>
      <button
        type="button"
        aria-label="Borrar issue o prioridad"
        onClick={() => (text.trim() ? setConfirm(true) : onDelete())}
        className="grid h-11 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>¿Borrar este elemento?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11 bg-destructive text-destructive-foreground" onClick={onDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

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
  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchCompanyIssueItems(userId, snapshotId, company, !readOnly),
  });
  const countKey = issueCommentCountsKey(snapshotId, company);
  const ids = items.map((i) => i.id);
  const { data: counts = {} } = useQuery({
    queryKey: [...countKey, ids.join(",")],
    queryFn: () => fetchIssueCommentCounts(ids),
    enabled: ids.length > 0,
  });
  const [newId, setNewId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      const item = await addCompanyIssueItem(userId, snapshotId, company);
      qc.setQueryData<CompanyIssueItem[]>(key, (current = []) => [...current, item]);
      setNewId(item.id);
    } catch {
      toast.error("No se pudo agregar. Intenta de nuevo.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (item: CompanyIssueItem) => {
    qc.setQueryData<CompanyIssueItem[]>(key, (current = []) =>
      current.filter((entry) => entry.id !== item.id).map((entry, index) => ({ ...entry, position: index + 1 })),
    );
    try {
      await deleteCompanyIssueItem(userId, item.id);
      await qc.invalidateQueries({ queryKey: key });
    } catch {
      toast.error("No se pudo borrar. Intenta de nuevo.");
      await qc.invalidateQueries({ queryKey: key });
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-soft">
      <div className="flex min-h-14 items-center justify-between px-4 py-3" style={{ borderLeft: `4px solid ${color}` }}>
        <h2 className="font-display text-base font-semibold">ISSUES / PRIORITIES</h2>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>
      <div className="border-t px-4 pb-3">
        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Cargando…</p>
        ) : items.length ? (
          <ol>
            {items.map((item) => (
              <IssueRow
                key={item.id}
                item={item}
                userId={userId}
                readOnly={readOnly}
                autoFocus={item.id === newId}
                onDelete={() => void remove(item)}
                onSaved={() => void qc.invalidateQueries({ queryKey: key })}
                commentCount={counts[item.id] ?? 0}
                countKey={[...countKey, ids.join(",")]}
              />
            ))}
          </ol>
        ) : (
          <p className="py-5 text-center text-sm text-muted-foreground">Sin issues ni prioridades</p>
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            disabled={adding}
            onClick={() => void add()}
            className="mt-1 min-h-11 w-full text-muted-foreground"
          >
            {adding ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Agregar elemento
          </Button>
        )}
      </div>
    </section>
  );
}