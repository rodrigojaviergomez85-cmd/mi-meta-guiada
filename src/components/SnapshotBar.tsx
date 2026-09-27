import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, type Snapshot } from "@/lib/goals";

export function SnapshotBar({ snapshot, readOnly }: { snapshot: Snapshot; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(snapshot);
  const qc = useQueryClient();

  const save = async () => {
    const { error } = await supabase
      .from("snapshots")
      .update({ label: f.label, month_label: f.month_label, week_label: f.week_label, annual_label: f.annual_label })
      .eq("id", snapshot.id);
    if (error) return toast.error("No se pudo guardar");
    toast.success("Guardado ✓");
    setEditing(false);
    qc.invalidateQueries();
  };

  if (editing) {
    const field = (k: "label" | "week_label" | "month_label" | "annual_label", l: string) => (
      <div className="space-y-1">
        <Label className="text-xs">{l}</Label>
        <Input className="h-11 text-base" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      </div>
    );
    return (
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        <div className="grid grid-cols-2 gap-3">
          {field("label", "Etiqueta")}
          {field("week_label", "Semana")}
          {field("month_label", "Mes")}
          {field("annual_label", "Anual")}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-11" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={save}>
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2 shadow-soft">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold">Semana: {snapshot.label}</p>
        <p className="truncate text-sm text-muted-foreground">Actualizado: {formatDateTime(snapshot.updated_at)}</p>
      </div>
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Editar etiquetas"
          onClick={() => {
            setF(snapshot);
            setEditing(true);
          }}
        >
          <Pencil className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
