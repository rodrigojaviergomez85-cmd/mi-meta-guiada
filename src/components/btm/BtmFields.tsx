import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBtmStatus, type Block, type Priority, type Scope } from "@/lib/btm";
import {
  blockError,
  DURATION_PRESETS,
  durationLabel,
  formatMinutes,
  hhmm,
  MAX_PRIORITIES,
  parseMinutes,
  totalMinutes,
} from "@/lib/btm-utils";
import { cn } from "@/lib/utils";

export function BtmStatusBadge() {
  const s = useBtmStatus();
  if (s === "idle") return null;
  const map = {
    pending: "Pendiente",
    saving: "Guardando…",
    saved: "Guardado ✓",
    error: "Error — reintentando",
  } as const;
  return (
    <span
      aria-live="polite"
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        s === "error" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {map[s]}
    </span>
  );
}

/**
 * Text field state that saves on every change: the edit is queued locally at once (durable if the tab closes);
 * only the network write is debounced inside the queue. Nothing is written on unmount, so a deleted row can't come back.
 */
function useLiveText(initial: string, save: (v: string) => void) {
  const [v, setV] = useState(initial);
  const saveRef = useRef(save);
  saveRef.current = save;
  const change = (nv: string) => {
    setV(nv);
    saveRef.current(nv);
  };
  return { v, change };
}

function DurationSelect({ value, onChange, id }: { value: number | null; onChange: (m: number | null) => void; id: string }) {
  const isPreset = value == null || DURATION_PRESETS.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [txt, setTxt] = useState(value && !isPreset ? String(value) : "");
  const err = custom && txt !== "" && parseMinutes(txt) == null;
  if (custom)
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <Input
            id={id}
            inputMode="numeric"
            aria-label="Minutos personalizados"
            aria-invalid={err}
            className="h-11 w-20 text-base"
            value={txt}
            placeholder="min"
            onChange={(e) => {
              setTxt(e.target.value);
              const m = parseMinutes(e.target.value);
              if (m != null) onChange(m);
            }}
          />
          <Button type="button" variant="ghost" className="h-11 px-2 text-xs" onClick={() => setCustom(false)}>
            Lista
          </Button>
        </div>
        {err && <span className="text-xs text-destructive">Minutos &gt; 0</span>}
      </div>
    );
  return (
    <Select
      value={value == null ? "none" : String(value)}
      onValueChange={(v) => {
        if (v === "custom") return setCustom(true);
        onChange(v === "none" ? null : Number(v));
      }}
    >
      <SelectTrigger id={id} className="h-11 w-[5.5rem] text-sm" aria-label="Duración">
        <SelectValue placeholder="Tiempo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {DURATION_PRESETS.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {durationLabel(m)}
          </SelectItem>
        ))}
        <SelectItem value="custom">Personalizado…</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PriorityRow({ row, onSave }: { row: Priority; onSave: (r: Priority) => void }) {
  // `row` identity (scope/date/slot) is fixed for this mounted instance: the parent keys it by date.
  const ident = useRef(row);
  const cur = useRef(row);
  cur.current = row;
  const t = useLiveText(row.text, (text) => onSave({ ...cur.current, ...pick(ident.current), text }));
  const id = `p-${row.scope}-${row.ref_date}-${row.position}`;
  return (
    <li className="flex items-start gap-2 py-1">
      <span className="mt-2.5 w-7 shrink-0 font-display text-sm font-bold text-muted-foreground">A{row.position}</span>
      <div className="flex h-11 w-9 shrink-0 items-center justify-center">
        <Checkbox
          aria-label={`Prioridad A${row.position} completada`}
          checked={row.done}
          onCheckedChange={(c) => onSave({ ...cur.current, ...pick(ident.current), text: t.v, done: !!c })}
          className="h-5 w-5"
        />
      </div>
      <Textarea
        aria-label={`Prioridad A${row.position}`}
        rows={1}
        value={t.v}
        placeholder="Actividad"
        onChange={(e) => t.change(e.target.value)}
        className={cn(
          "field-sizing-content min-h-11 min-w-0 flex-1 resize-none py-2.5 text-base",
          row.done && "text-muted-foreground line-through",
        )}
      />
      <DurationSelect id={id} value={row.minutes} onChange={(m) => onSave({ ...cur.current, ...pick(ident.current), text: t.v, minutes: m })} />
    </li>
  );
}
const pick = (r: Priority) => ({ scope: r.scope, ref_date: r.ref_date, position: r.position });

export function PriorityList({
  scope,
  refDate,
  priorities,
  onSave,
}: {
  scope: Scope;
  refDate: string;
  priorities: Priority[];
  onSave: (r: Priority) => void;
}) {
  const rows = Array.from({ length: MAX_PRIORITIES }, (_, i) => {
    const pos = i + 1;
    return priorities.find((p) => p.position === pos) ?? { scope, ref_date: refDate, position: pos, text: "", minutes: null, done: false };
  });
  const done = rows.filter((r) => r.done).length;
  const used = rows.filter((r) => r.text.trim()).length;
  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Prioridades</h2>
        <p className="text-sm text-muted-foreground">
          {done}/{used} · Total: <span className="font-semibold text-foreground">{formatMinutes(totalMinutes(rows))}</span>
        </p>
      </div>
      <ul>
        {rows.map((r) => (
          <PriorityRow key={`${scope}|${refDate}|${r.position}`} row={r} onSave={onSave} />
        ))}
      </ul>
    </section>
  );
}

export function FollowUp({ day, value, onSave }: { day: string; value: string; onSave: (day: string, v: string) => void }) {
  const dayRef = useRef(day); // captured at mount (parent keys by day)
  const t = useLiveText(value, (v) => onSave(dayRef.current, v));
  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft">
      <label htmlFor={`fu-${day}`} className="mb-2 block font-display text-lg font-semibold">
        Seguimiento
      </label>
      <Textarea
        id={`fu-${day}`}
        value={t.v}
        onChange={(e) => t.change(e.target.value)}
        placeholder="Follow up…"
        className="field-sizing-content min-h-20 text-base"
      />
    </section>
  );
}

function BlockRow({ block, onSave, onDelete }: { block: Block; onSave: (b: Block) => void; onDelete: () => void }) {
  const [start, setStart] = useState(hhmm(block.start_time));
  const [end, setEnd] = useState(hhmm(block.end_time));
  const ident = useRef({ id: block.id, day: block.day });
  const times = useRef({ start, end });
  times.current = { start, end };
  const err = blockError(start, end);
  const act = useLiveText(block.activity, (activity) => {
    const { start: s, end: e } = times.current;
    if (!blockError(s, e)) onSave({ ...ident.current, start_time: s, end_time: e, activity });
  });
  const setTime = (s: string, e: string) => {
    setStart(s);
    setEnd(e);
    if (!blockError(s, e)) onSave({ ...ident.current, start_time: s, end_time: e, activity: act.v });
  };
  return (
    <li className="space-y-1 border-b border-border py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="time" aria-label="Hora inicio" value={start} onChange={(e) => setTime(e.target.value, end)} className="h-11 w-[6.5rem] text-base" aria-invalid={!!err} />
        <span aria-hidden>–</span>
        <Input type="time" aria-label="Hora fin" value={end} onChange={(e) => setTime(start, e.target.value)} className="h-11 w-[6.5rem] text-base" aria-invalid={!!err} />
        <Button type="button" variant="ghost" size="icon" className="ml-auto h-11 w-11 text-muted-foreground" aria-label="Borrar bloque" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {err && (
        <p role="alert" className="text-xs text-destructive">
          {err} — no se guardará hasta corregirlo.
        </p>
      )}
      <Input aria-label="Actividad" value={act.v} placeholder="Actividad" onChange={(e) => act.change(e.target.value)} className="h-11 text-base" />
    </li>
  );
}

export function Agenda({
  day,
  blocks,
  onSave,
  onDelete,
}: {
  day: string;
  blocks: Block[];
  onSave: (b: Block) => void;
  onDelete: (id: string, day: string) => void;
}) {
  const add = () => {
    const last = blocks[blocks.length - 1];
    const s = last ? hhmm(last.end_time) : "07:00";
    const [h, m] = s.split(":").map(Number);
    const endMin = Math.min(h! * 60 + m! + 30, 23 * 60 + 59);
    const e = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    if (blockError(s, e)) return;
    onSave({ id: crypto.randomUUID(), day, start_time: s, end_time: e, activity: "" });
  };
  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="mb-1 font-display text-lg font-semibold">Agenda</h2>
      {blocks.length === 0 && <p className="py-2 text-sm text-muted-foreground">Sin bloques todavía.</p>}
      <ul>
        {blocks.map((b) => (
          <BlockRow key={b.id} block={b} onSave={onSave} onDelete={() => onDelete(b.id, b.day)} />
        ))}
      </ul>
      <Button type="button" variant="ghost" className="mt-2 min-h-11 w-full" onClick={add}>
        + Agregar bloque
      </Button>
    </section>
  );
}
