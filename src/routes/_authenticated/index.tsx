import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, ClipboardList, Download, History, Lightbulb, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SnapshotBar } from "@/components/SnapshotBar";
import { NewWeekDialog } from "@/components/NewWeekDialog";
import { SaveIndicator } from "@/components/SaveIndicator";
import { CompanyCards } from "@/components/CompanyCards";
import { useCurrent, useProfile } from "@/lib/hooks";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Mi 411 — Inicio" },
      { name: "description", content: "Resumen semanal de metas Personal, E4CC y E4Kids." },
      { property: "og:title", content: "Mi 411 — Inicio" },
      { property: "og:description", content: "Resumen semanal de metas Personal, E4CC y E4Kids." },
    ],
  }),
  component: Home,
});

function CoreValues({ value }: { value: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const qc = useQueryClient();
  const save = async () => {
    setEditing(false);
    if (v === value) return;
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ core_values: v }).eq("id", data.user!.id);
    if (error) toast.error("No se pudo guardar");
    else toast.success("Guardado ✓");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  if (editing)
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full rounded-lg bg-card px-2 py-2 text-sm outline-none ring-2 ring-ring/40"
      />
    );
  return (
    <button
      type="button"
      onClick={() => {
        setV(value);
        setEditing(true);
      }}
      className="min-h-11 text-left text-sm text-muted-foreground"
    >
      <span className="font-semibold text-foreground">Core Values:</span> {value}
    </button>
  );
}

function Home() {
  const { data, isLoading, error } = useCurrent();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 pb-28 pt-6 lg:pb-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Mi 411</h1>
          <p className="truncate font-medium">{profile?.name ?? "Rodrigo Galdamez"}</p>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator />
          <Button className="hidden h-11 lg:inline-flex" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-5 w-5" /> Nueva semana
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Cerrar sesión" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      {profile && <CoreValues value={profile.core_values} />}

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {error && <p className="text-destructive">No se pudieron cargar tus metas.</p>}
      {!isLoading && !error && !data && (
        <section className="space-y-4 rounded-2xl bg-card p-6 text-center shadow-soft">
          <p className="font-display text-xl font-semibold">No hay semana activa</p>
          <div className="flex flex-col items-center gap-2">
            <Button className="h-11" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-5 w-5" /> Nueva semana
            </Button>
            <Link to="/historial" className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground">
              Ver Historial
            </Link>
          </div>
        </section>
      )}
      {data && (
        <>
          <SnapshotBar snapshot={data.snapshot} />
          <CompanyCards goals={data.goals} />
        </>
      )}

      <Link
        to="/btm"
        className="flex min-h-16 items-center gap-3 rounded-2xl bg-card p-4 shadow-soft transition hover:shadow-md"
      >
        <ClipboardList className="h-6 w-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold">BTM</span>
          <span className="block text-sm text-muted-foreground">Planeación semanal y diaria</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <Link
        to="/ideas"
        className="flex min-h-16 items-center gap-3 rounded-2xl bg-card p-4 shadow-soft transition hover:shadow-md"
      >
        <Lightbulb className="h-6 w-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold">Ideas / Notas</span>
          <span className="block text-sm text-muted-foreground">Personal, E4Kids, E4CC y Otros</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <div className="flex flex-wrap items-center gap-x-6">
        <Link to="/historial" className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground hover:text-foreground">
          <History className="h-5 w-5" /> Historial
        </Link>
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const { downloadBackup } = await import("@/lib/backup");
              await downloadBackup();
              toast.success("Respaldo descargado ✓");
            } catch {
              toast.error("No se pudo crear el respaldo. Revisa tu conexión e intenta de nuevo.");
            } finally {
              setExporting(false);
            }
          }}
          className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Download className="h-5 w-5" /> {exporting ? "Preparando…" : "Descargar respaldo (Excel)"}
        </button>
      </div>

      <Button
        className="fixed bottom-6 right-5 h-14 rounded-full px-6 text-base shadow-soft lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-5 w-5" /> Nueva semana
      </Button>
      <NewWeekDialog open={open} onOpenChange={setOpen} />
    </main>
  );
}
