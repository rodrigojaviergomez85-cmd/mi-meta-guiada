import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, type Snapshot } from "@/lib/goals";
import { WeekPicker, mondayOf, parseDate, rangeText, weekInfo } from "@/components/WeekPicker";

export function SnapshotBar({ snapshot, readOnly }: { snapshot: Snapshot; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(snapshot);
  const [picker, setPicker] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    const { error } = await supabase
      .from("snapshots")
      .update({
        label: f.label,
        month_label: f.month_label,
        week_label: f.week_label,
        annual_label: f.annual_label,
        week_start: f.week_start,
        week_end: f.week_end,
        week_number: f.week_number,
        year: f.year,
      })
      .eq("id", snapshot.id);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
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
    const monday = mondayOf(parseDate(f.week_start ?? f.snapshot_date));
    return (
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        {picker ? (
          <WeekPicker
            monday={monday}
            excludeId={snapshot.id}
            onChange={(m) => {
              const i = weekInfo(m);
              setF({
                ...f,
                label: i.label,
                week_label: i.week_label,
                month_label: i.month_label,
                week_start: i.week_start,
                week_end: i.week_end,
                week_number: i.week_number,
                year: i.year,
              });
            }}
          />
        ) : (
          <Button variant="outline" className="h-11 w-full" onClick={() => setPicker(true)}>
            <CalendarDays className="mr-2 h-4 w-4" /> Elegir semana en calendario
          </Button>
        )}
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

  const hasWeek = snapshot.week_number != null;
  const range =
    snapshot.week_start && snapshot.week_end
      ? `${rangeText(parseDate(snapshot.week_start), parseDate(snapshot.week_end))} · `
      : "";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2 shadow-soft">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold">
          {hasWeek ? `Semana ${snapshot.week_number} · ${snapshot.label}` : `Semana: ${snapshot.label}`}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {hasWeek ? range : ""}Actualizado: {formatDateTime(snapshot.updated_at)}
        </p>
      </div>
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Editar etiquetas"
          onClick={() => {
            setF(snapshot);
            setPicker(false);
            setEditing(true);
          }}
        >
          <Pencil className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
