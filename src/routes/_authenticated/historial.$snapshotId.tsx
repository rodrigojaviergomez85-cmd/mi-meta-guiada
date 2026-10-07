import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CompanyGoals } from "@/components/CompanyGoals";
import { CompanyIssues } from "@/components/CompanyIssues";
import { SnapshotBar } from "@/components/SnapshotBar";
import { CompanyCards } from "@/components/CompanyCards";
import { COMPANIES } from "@/lib/goals";
import { useSnapshot } from "@/lib/hooks";

export const Route = createFileRoute("/_authenticated/historial/$snapshotId")({
  head: () => ({
    meta: [
      { title: "Semana anterior — Mi 411" },
      { name: "description", content: "Vista de solo lectura de una semana anterior." },
      { property: "og:title", content: "Semana anterior — Mi 411" },
      { property: "og:description", content: "Vista de solo lectura de una semana anterior." },
    ],
  }),
  component: SnapshotView,
});

function SnapshotView() {
  const { snapshotId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data, isLoading, error } = useSnapshot(snapshotId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const makeCurrent = async () => {
    const { error } = await supabase.rpc("make_current", { _id: snapshotId });
    if (error) {
      toast.error("No se pudo cambiar");
      return;
    }
    await qc.invalidateQueries();
    toast.success("Ahora es la semana actual");
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-4 pb-10 pt-4">
      <header className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11">
          <Link to="/historial" aria-label="Volver al historial">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Semana {data?.snapshot.label}</h1>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-dashed bg-muted p-4 sm:flex-row sm:items-center">
        <p className="flex flex-1 items-center gap-2 font-medium">
          <Eye className="h-5 w-5 shrink-0" /> Viendo semana anterior — solo lectura
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11">
            <Link to="/">Volver a la semana actual</Link>
          </Button>
          {data && !data.snapshot.is_current && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="h-11">
                  Hacer actual
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Hacer actual esta semana?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La semana {data.snapshot.label} pasará a ser la semana actual y podrás editarla. La otra semana se conserva en el historial.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="h-11" onClick={makeCurrent}>
                    Hacer actual
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {error && <p className="text-destructive">No se encontró esta semana.</p>}
      {data && (
        <>
          <SnapshotBar snapshot={data.snapshot} readOnly />
          <CompanyCards goals={data.goals} linkable={false} />
          <div className="grid gap-8 lg:grid-cols-3 lg:gap-5">
            {COMPANIES.map((c) => (
              <CompanyGoals
                key={c.id}
                data={data}
                company={c.id}
                readOnly
                onPatch={() => {}}
                showTitle
                annualAside={
                  <CompanyIssues
                    userId={user.id}
                    snapshotId={data.snapshot.id}
                    company={c.id}
                    color={c.color}
                    readOnly
                  />
                }
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
