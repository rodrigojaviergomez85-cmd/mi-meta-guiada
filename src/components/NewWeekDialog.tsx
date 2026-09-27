import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { currentMonthLabel, flush, todayLabel } from "@/lib/goals";

export function NewWeekDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [label, setLabel] = useState(todayLabel());
  const [week, setWeek] = useState("");
  const [month, setMonth] = useState(currentMonthLabel());
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await flush(); // make sure pending edits land before copying
    const { error } = await supabase.rpc("create_new_week", {
      _label: label.trim() || todayLabel(),
      _week_label: week.trim(),
      _month_label: month.trim(),
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
        if (o) {
          setLabel(todayLabel());
          setWeek("");
          setMonth(currentMonthLabel());
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nueva semana</DialogTitle>
            <DialogDescription>Se copiarán todas tus metas actuales, sin marcar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nw-label">Etiqueta</Label>
            <Input id="nw-label" className="h-12 text-base" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nw-week">Semana</Label>
            <Input id="nw-week" className="h-12 text-base" placeholder="ej. 14-19 SEPT" value={week} onChange={(e) => setWeek(e.target.value)} />
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
              {busy ? "Creando…" : "Crear semana"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
