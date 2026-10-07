import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResponsivePanel } from "./ResponsivePanel";
import { useQuery } from "@tanstack/react-query";
import { commentCountsKey, relativeDate } from "@/lib/people";
import type { Goal } from "@/lib/goals";

type Comment = { id: string; body: string; created_at: string; updated_at: string };
export type CommentSource = {
  table: "goal_comments" | "issue_item_comments";
  fk: "goal_id" | "item_id";
  parentId: string;
  countKey: readonly unknown[];
};

export function CommentsChip({ goal, count, readOnly }: { goal: Goal; count: number; readOnly?: boolean | undefined }) {
  return (
    <CommentThreadChip
      source={{ table: "goal_comments", fk: "goal_id", parentId: goal.id, countKey: commentCountsKey(goal.snapshot_id) }}
      title={goal.text || "Meta sin texto"}
      count={count}
      readOnly={readOnly}
    />
  );
}

export function CommentThreadChip({
  source,
  title,
  count,
  readOnly,
}: {
  source: CommentSource;
  title: string;
  count: number;
  readOnly?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (readOnly && count === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="-my-1 flex min-h-11 items-center">
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-2.5 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {count > 0 ? <span className="font-medium text-foreground">{count}</span> : "Comentar"}
        </span>
      </button>
      <ResponsivePanel open={open} onOpenChange={setOpen} title={title}>
        {open && <Thread source={source} readOnly={readOnly} />}
      </ResponsivePanel>
    </>
  );
}

// The comment tables share the same shape; the client is typed per table, so it is narrowed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (t: CommentSource["table"]) => supabase.from(t as "goal_comments") as any;

function Thread({ source, readOnly }: { source: CommentSource; readOnly?: boolean | undefined }) {
  const qc = useQueryClient();
  const key = ["comments", source.table, source.parentId] as const;
  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await tbl(source.table).select("*").eq(source.fk, source.parentId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [body, setBody] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const countKey = source.countKey;
  const pid = source.parentId;

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [comments.length]);

  const bump = (d: number) =>
    qc.setQueryData<Record<string, number>>(countKey, (o) => ({ ...o, [pid]: Math.max(0, (o?.[pid] ?? 0) + d) }));

  const send = async () => {
    const b = body.trim();
    if (!b) return;
    setBody("");
    const temp: Comment = { id: `tmp-${Date.now()}`, body: b, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    qc.setQueryData<Comment[]>(key, (o) => [...(o ?? []), temp]);
    bump(1);
    const { error } = await tbl(source.table).insert({ [source.fk]: pid, body: b });
    if (error) {
      toast.error("No se pudo enviar el comentario");
      setBody(b);
      bump(-1);
    }
    void qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (c: Comment) => {
    qc.setQueryData<Comment[]>(key, (o) => (o ?? []).filter((x) => x.id !== c.id));
    bump(-1);
    const { error } = await tbl(source.table).delete().eq("id", c.id);
    if (error) {
      toast.error("No se pudo eliminar");
      bump(1);
    }
    void qc.invalidateQueries({ queryKey: key });
  };

  const saveEdit = async (c: Comment) => {
    const b = editBody.trim();
    setEditId(null);
    if (!b || b === c.body) return;
    qc.setQueryData<Comment[]>(key, (o) => (o ?? []).map((x) => (x.id === c.id ? { ...x, body: b } : x)));
    const { error } = await tbl(source.table).update({ body: b }).eq("id", c.id);
    if (error) toast.error("No se pudo guardar");
    void qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-[8rem] flex-1 space-y-3 overflow-y-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && comments.length === 0 && <p className="text-sm text-muted-foreground">Sin comentarios todavía.</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-xl bg-muted p-3">
            <div className="flex items-start gap-2">
              {editId === c.id ? (
                <div className="flex-1 space-y-2">
                  <Textarea autoFocus value={editBody} onChange={(e) => setEditBody(e.target.value)} className="text-base" />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="h-11" onClick={() => setEditId(null)}>Cancelar</Button>
                    <Button className="h-11" onClick={() => void saveEdit(c)}>Guardar</Button>
                  </div>
                </div>
              ) : (
                <p className="flex-1 whitespace-pre-wrap break-words text-base">{c.body}</p>
              )}
              {!readOnly && editId !== c.id && !c.id.startsWith("tmp-") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-m-2 h-11 w-11 shrink-0" aria-label="Opciones">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="min-h-11" onClick={() => { setEditBody(c.body); setEditId(c.id); }}>Editar</DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11 text-destructive" onClick={() => void remove(c)}>Eliminar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{relativeDate(c.created_at)}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {!readOnly && (
        <div className="space-y-2">
          <Textarea
            placeholder="Escribe un comentario…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            className="text-base"
          />
          <div className="flex justify-end">
            <Button className="h-11" disabled={!body.trim()} onClick={() => void send()}>Enviar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
