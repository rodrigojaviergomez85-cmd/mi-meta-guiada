import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { flush } from "@/lib/goals";
import { WeekPicker, defaultMonday, findExisting, mondayOf, useExistingWeeks, weekInfo } from "@/components/WeekPicker";

export function NewWeekDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const init = weekInfo(monday);
  const [label, setLabel] = useState(init.label);
  const [week, setWeek] = useState(init.week_label);
  const [month, setMonth] = useState(init.month_label);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: existing = [] } = useExistingWeeks();
  const dup = findExisting(existing, monday);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) setTouched(false);
  }, [open]);
  useEffect(() => {
    if (open && !touched) pick(defaultMonday(existing));
  }, [open, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (m: Date) => {
    setMonday(m);
    const i = weekInfo(m);
    setLabel(i.label);
    setWeek(i.week_label);
    setMonth(i.month_label);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await flush(); // make sure pending edits land before copying
    const i = weekInfo(monday);
    const { error } = await supabase.rpc("create_new_week", {
      _label: label.trim() || i.label,
      _week_label: week.trim(),
      _month_label: month.trim(),
      _week_start: i.week_start,
      _week_end: i.week_end,
      _week_number: i.week_number,
      _year: i.year,
    });
    setBusy(false);
    if (error) {
      toast.error("No se pudo crear la semana");
      return;
    }
    await qc.invalidateQueries();
    toast.success("Nueva semana creada");
    onOpenChange(false);
    navigate({ to: "/" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setTouched(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[95dvh] overflow-y-auto rounded-2xl p-4 sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nueva semana</DialogTitle>
            <DialogDescription>Se copiarán todas tus metas actuales, sin marcar.</DialogDescription>
          </DialogHeader>
          <WeekPicker monday={monday} onChange={(m) => { setTouched(true); pick(m); }} />
          <div className="space-y-2">
            <Label htmlFor="nw-label">Etiqueta</Label>
            <Input id="nw-label" className="h-12 text-base" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nw-week">Semana</Label>
            <Input id="nw-week" className="h-12 text-base" value={week} onChange={(e) => setWeek(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nw-month">Mes</Label>
            <Input id="nw-month" className="h-12 text-base" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-12" disabled={busy}>
              {busy ? "Creando…" : dup ? "Crear de todos modos" : "Crear semana"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
