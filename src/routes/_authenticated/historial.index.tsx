import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Snapshot } from "@/lib/goals";

export const Route = createFileRoute("/_authenticated/historial/")({
  head: () => ({
    meta: [
      { title: "Historial — Mi 411" },
      { name: "description", content: "Todas tus semanas anteriores de metas." },
      { property: "og:title", content: "Historial — Mi 411" },
      { property: "og:description", content: "Todas tus semanas anteriores de metas." },
    ],
  }),
  component: HistoryPage,
});

type Row = Snapshot & { done: number; total: number };

async function fetchHistory(): Promise<Row[]> {
  const [{ data: snaps, error }, { data: goals }] = await Promise.all([
    supabase.from("snapshots").select("*").order("snapshot_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("goals").select("snapshot_id, done"),
  ]);
  if (error) throw error;
  const counts: Record<string, number> = {};
  const totals: Record<string, number> = {};
  (goals ?? []).forEach((g) => {
    totals[g.snapshot_id] = (totals[g.snapshot_id] ?? 0) + 1;
    if (g.done) counts[g.snapshot_id] = (counts[g.snapshot_id] ?? 0) + 1;
  });
  return (snaps ?? []).map((s) => ({ ...s, done: counts[s.id] ?? 0, total: totals[s.id] ?? 0 }));
}

function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["snapshots"], queryFn: fetchHistory });
  const qc = useQueryClient();
  const [del, setDel] = useState<Row | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [label, setLabel] = useState("");

  const doDelete = async () => {
    if (!del) return;
    const { error } = await supabase.from("snapshots").delete().eq("id", del.id);
    if (error) toast.error("No se pudo eliminar");
    else toast.success("Semana eliminada");
    setDel(null);
    qc.invalidateQueries();
  };
  const doRename = async () => {
    if (!edit) return;
    const { error } = await supabase.from("snapshots").update({ label }).eq("id", edit.id);
    if (error) toast.error("No se pudo guardar");
    else toast.success("Guardado ✓");
    setEdit(null);
    qc.invalidateQueries();
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-4">
      <header className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11">
          <Link to="/" aria-label="Volver">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Historial</h1>
      </header>
      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      <ul className="space-y-3">
        {data?.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-2xl bg-card pr-2 shadow-soft">
            <Link to="/historial/$snapshotId" params={{ snapshotId: s.id }} className="min-w-0 flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold">{s.label}</span>
                {s.is_current && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Actual</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[s.week_label, s.month_label, new Date(s.snapshot_date + "T00:00").toLocaleDateString("es")].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{s.done}/{s.total}</span> completadas
              </p>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Opciones">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="min-h-11"
                  onClick={() => {
                    setLabel(s.label);
                    setEdit(s);
                  }}
                >
                  Editar etiqueta
                </DropdownMenuItem>
                {!s.is_current && (
                  <DropdownMenuItem className="min-h-11 text-destructive" onClick={() => setDel(s)}>
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la semana {del?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán sus {del?.total} metas. Esta acción no se puede deshacer.
              {del?.is_current && " Es la semana actual."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11 bg-destructive text-destructive-foreground" onClick={doDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar etiqueta</DialogTitle>
          </DialogHeader>
          <Input className="h-12 text-base" value={label} onChange={(e) => setLabel(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button className="h-11" onClick={doRename}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
