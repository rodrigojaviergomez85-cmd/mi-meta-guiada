import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Minus, Plus, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBtmUser } from "@/lib/btm";
import { todayKey } from "@/lib/btm-utils";
import {
  addIdea,
  asTable,
  newTable,
  CATEGORIES,
  categoryInfo,
  deleteIdea,
  fetchIdeas,
  ideasKey,
  persistPending,
  readPending,
  saveIdea,
  sortIdeas,
  type Idea,
  type IdeaCategory,
  type IdeaPatch,
} from "@/lib/ideas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ideas")({
  head: () => ({
    meta: [
      { title: "Mi 411 — Ideas y notas" },
      { name: "description", content: "Lista de ideas y notas por categoría: Personal, E4Kids, E4CC y Otros." },
      { property: "og:title", content: "Mi 411 — Ideas y notas" },
      { property: "og:description", content: "Lista de ideas y notas por categoría: Personal, E4Kids, E4CC y Otros." },
    ],
  }),
  component: IdeasPage,
});

type Filter = "all" | IdeaCategory;

function IdeasPage() {
  const uid = useBtmUser();
  if (!uid) return <main className="mx-auto max-w-3xl px-4 pt-6 text-muted-foreground">Cargando…</main>;
  return <IdeasList uid={uid} />;
}

function IdeasList({ uid }: { uid: string }) {
  const qc = useQueryClient();
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ideasKey(uid), queryFn: () => fetchIdeas(uid) });
  const [sort, setSort] = useState<"date" | "category">("date");
  const [filter, setFilter] = useState<Filter>("all");
  const [autoEdit, setAutoEdit] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Retry edits left on this device from an earlier visit.
  useEffect(() => {
    const p = readPending(uid);
    for (const [id, patch] of Object.entries(p)) void saveIdea(uid, id, patch).catch(() => {});
  }, [uid]);

  const update = (id: string, patch: IdeaPatch) =>
    qc.setQueryData<Idea[]>(ideasKey(uid), (o) => o?.map((i) => (i.id === id ? ({ ...i, ...patch } as Idea) : i)));

  const add = async () => {
    setAdding(true);
    try {
      const row = await addIdea(uid, filter === "all" ? "personal" : filter, todayKey());
      qc.setQueryData<Idea[]>(ideasKey(uid), (o) => [row, ...(o ?? [])]);
      setAutoEdit(row.id);
    } catch {
      toast.error("No se pudo agregar la idea. Revisa tu conexión.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    const prev = qc.getQueryData<Idea[]>(ideasKey(uid));
    qc.setQueryData<Idea[]>(ideasKey(uid), (o) => o?.filter((i) => i.id !== id));
    try {
      await deleteIdea(uid, id);
    } catch {
      qc.setQueryData(ideasKey(uid), prev);
      toast.error("No se pudo borrar la idea.");
    }
  };

  const list = sortIdeas(filter === "all" ? data : data.filter((i) => i.category === filter), sort);
  const doneCount = list.filter((i) => i.done).length;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11">
          <Link to="/" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-2xl font-bold">Ideas / Notas</h1>
        <span className="text-sm text-muted-foreground">
          {doneCount}/{list.length}
        </span>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Categoría">
        {([{ id: "all", name: "Todas", color: "var(--foreground)" }, ...CATEGORIES] as const).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id as Filter)}
            aria-pressed={filter === c.id}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium",
              filter === c.id ? "border-transparent bg-muted" : "border-input text-muted-foreground",
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar por:</span>
        {(["date", "category"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            aria-pressed={sort === s}
            className={cn("min-h-11 rounded-lg px-3 font-medium", sort === s ? "bg-muted" : "text-muted-foreground")}
          >
            {s === "date" ? "Fecha" : "Categoría"}
          </button>
        ))}
      </div>

      <Button className="h-11 w-full sm:w-auto" onClick={() => void add()} disabled={adding}>
        <Plus className="mr-1 h-5 w-5" /> Agregar idea
      </Button>

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {error && (
        <p className="text-destructive">
          No se pudieron cargar tus ideas.{" "}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Reintentar
          </button>
        </p>
      )}
      {!isLoading && !error && !list.length && <p className="text-muted-foreground">Aún no hay ideas aquí.</p>}

      <ul className="space-y-3">
        {list.map((idea) => (
          <IdeaRow
            key={idea.id}
            uid={uid}
            idea={idea}
            autoEdit={autoEdit === idea.id}
            onLocal={(p) => update(idea.id, p)}
            onDelete={() => void remove(idea.id)}
          />
        ))}
      </ul>
    </main>
  );
}

function IdeaRow({
  uid,
  idea,
  autoEdit,
  onLocal,
  onDelete,
}: {
  uid: string;
  idea: Idea;
  autoEdit: boolean;
  onLocal: (p: IdeaPatch) => void;
  onDelete: () => void;
}) {
  const [state, setState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [confirm, setConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ta = useRef<HTMLTextAreaElement>(null);
  const info = categoryInfo(idea.category);
  const table = asTable(idea.table_data);

  const send = async (patch: IdeaPatch) => {
    setState("saving");
    try {
      await saveIdea(uid, idea.id, patch);
      setState("saved");
    } catch {
      setState("error");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void send(patch), 5000);
    }
  };
  const change = (patch: IdeaPatch, debounce = false) => {
    onLocal(patch);
    persistPending(uid, idea.id, patch); // kept on the device immediately
    setState("pending");
    clearTimeout(timer.current);
    if (debounce) timer.current = setTimeout(() => void send(readPending(uid)[idea.id] ?? patch), 800);
    else void send(readPending(uid)[idea.id] ?? patch);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (autoEdit) ta.current?.focus();
  }, [autoEdit]);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [idea.text]);

  return (
    <li className="rounded-2xl bg-card p-3 shadow-soft" style={{ borderLeft: `4px solid ${info.color}` }}>
      <div className="flex items-start gap-2">
        <div className="grid h-11 w-8 shrink-0 place-items-center">
          <Checkbox checked={idea.done} onCheckedChange={(v) => change({ done: v === true })} aria-label="Marcar como hecha" className="h-5 w-5" />
        </div>
        <textarea
          ref={ta}
          rows={1}
          value={idea.text}
          placeholder="Escribe tu idea…"
          onChange={(e) => change({ text: e.target.value }, true)}
          onBlur={() => {
            const p = readPending(uid)[idea.id];
            if (p) {
              clearTimeout(timer.current);
              void send(p);
            }
          }}
          className={cn(
            "min-h-11 flex-1 resize-none overflow-hidden bg-transparent py-2.5 text-base outline-none",
            idea.done && "text-muted-foreground line-through",
          )}
        />
        <button
          type="button"
          aria-label="Borrar idea"
          onClick={() => (idea.text.trim() ? setConfirm(true) : onDelete())}
          className="grid h-11 w-9 shrink-0 place-items-center text-muted-foreground/60 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 pl-10">
        <select
          value={idea.category}
          aria-label="Categoría"
          onChange={(e) => change({ category: e.target.value })}
          className="min-h-11 rounded-full border border-input bg-background px-3 text-sm font-medium"
          style={{ color: info.color }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Fecha de la idea"
          value={idea.idea_date}
          onChange={(e) => e.target.value && change({ idea_date: e.target.value })}
          className="min-h-11 rounded-full border border-input bg-background px-3 text-sm"
        />
        {!table && (
          <button
            type="button"
            onClick={() => change({ table_data: newTable() })}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-input px-3 text-sm text-muted-foreground"
          >
            <Table2 className="h-4 w-4" /> Tabla
          </button>
        )}
        <span className={cn("text-xs", state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {state === "pending" && "Pendiente"}
          {state === "saving" && "Guardando…"}
          {state === "saved" && "Guardado ✓"}
          {state === "error" && "Error, se reintentará"}
        </span>
      </div>
      {table && <IdeaTable table={table} onChange={(t, d) => change({ table_data: t }, d)} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta idea?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function IdeaTable({ table, onChange }: { table: string[][]; onChange: (t: string[][] | null, debounce?: boolean) => void }) {
  const cols = Math.max(1, ...table.map((r) => r.length));
  const rows = table.map((r) => [...r, ...Array(cols - r.length).fill("")] as string[]);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (ri: number, ci: number, v: string) =>
    onChange(rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)), true);
  const hasText = rows.some((r) => r.some((c) => c.trim()));
  return (
    <div className="mt-2 space-y-2 pl-10">
      <div className="max-w-full overflow-x-auto rounded-lg border border-input">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className={cn(ri === 0 && "bg-muted font-semibold")}>
                {r.map((c, ci) => (
                  <td key={ci} className="min-w-28 border border-input p-0 align-top">
                    <textarea
                      rows={1}
                      value={c}
                      aria-label={`Fila ${ri + 1}, columna ${ci + 1}`}
                      onChange={(e) => set(ri, ci, e.target.value)}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = `${el.scrollHeight}px`;
                      }}
                      className="block min-h-11 w-full resize-none bg-transparent px-2 py-2.5 text-base outline-none focus:bg-accent/40"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1 text-sm">
        <Button variant="ghost" className="h-11" onClick={() => onChange([...rows, Array(cols).fill("")])}>
          <Plus className="mr-1 h-4 w-4" /> Fila
        </Button>
        <Button variant="ghost" className="h-11" disabled={rows.length <= 1} onClick={() => onChange(rows.slice(0, -1))}>
          <Minus className="mr-1 h-4 w-4" /> Fila
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => onChange(rows.map((r) => [...r, ""]))}>
          <Plus className="mr-1 h-4 w-4" /> Columna
        </Button>
        <Button variant="ghost" className="h-11" disabled={cols <= 1} onClick={() => onChange(rows.map((r) => r.slice(0, -1)))}>
          <Minus className="mr-1 h-4 w-4" /> Columna
        </Button>
        <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => (hasText ? setConfirmDel(true) : onChange(null))}>
          <Trash2 className="mr-1 h-4 w-4" /> Quitar tabla
        </Button>
      </div>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar la tabla y su contenido?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onChange(null)}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
