import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "./ResponsivePanel";
import { initials, peopleKey, personColor, usePeople, type Person } from "@/lib/people";
import { cn } from "@/lib/utils";

export function PersonAvatar({ person }: { person: Person }) {
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-background"
      style={{ backgroundColor: personColor(person.id) }}
    >
      {initials(person.name)}
    </span>
  );
}

export function AssigneeChip({
  assigneeId,
  readOnly,
  onChange,
}: {
  assigneeId: string | null;
  readOnly?: boolean | undefined;
  onChange: (id: string | null) => void;
}) {
  const { data: people = [] } = usePeople();
  const [open, setOpen] = useState(false);
  const person = people.find((p) => p.id === assigneeId);
  if (readOnly && !person) return null;

  return (
    <>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpen(true)}
        className="-my-1 flex min-h-11 items-center disabled:cursor-default"
      >
        <span
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm",
            person ? "bg-muted" : "border border-dashed border-input text-muted-foreground",
          )}
        >
          {person ? (
            <>
              <PersonAvatar person={person} />
              <span className="max-w-[9rem] truncate">{person.name.split(" ")[0]}</span>
            </>
          ) : (
            <>
              <UserRound className="h-4 w-4" /> Responsable
            </>
          )}
        </span>
      </button>
      {!readOnly && (
        <ResponsivePanel open={open} onOpenChange={setOpen} title="Responsable">
          <PeoplePicker
            people={people}
            current={assigneeId}
            onPick={(id) => {
              onChange(id);
              setOpen(false);
            }}
          />
        </ResponsivePanel>
      )}
    </>
  );
}

function PeoplePicker({
  people,
  current,
  onPick,
}: {
  people: Person[];
  current: string | null;
  onPick: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [manage, setManage] = useState(false);
  const list = people.filter((p) => p.active && p.name.toLowerCase().includes(q.toLowerCase()));

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const { data, error } = await supabase.from("people").insert({ name: n }).select().single();
    if (error) {
      toast.error(error.code === "23505" ? "Esa persona ya existe" : "No se pudo agregar");
      return;
    }
    await qc.invalidateQueries({ queryKey: peopleKey });
    setName("");
    setAdding(false);
    onPick(data.id);
  };

  if (manage) return <PeopleManager people={people} onBack={() => setManage(false)} />;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 text-base" />
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={() => onPick(null)}
            className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-muted-foreground hover:bg-muted", !current && "bg-muted")}
          >
            <UserRound className="h-5 w-5" /> <span className="flex-1">Sin responsable</span>
            {!current && <Check className="h-4 w-4" />}
          </button>
        </li>
        {list.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p.id)}
              className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-muted", current === p.id && "bg-muted font-semibold")}
            >
              <PersonAvatar person={p} /> <span className="flex-1 truncate">{p.name}</span>
              {current === p.id && <Check className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input autoFocus placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-base" />
          <Button type="submit" className="h-11">Guardar</Button>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="h-11" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Agregar persona
          </Button>
          <button type="button" onClick={() => setManage(true)} className="min-h-11 px-2 text-sm text-muted-foreground underline">
            Gestionar
          </button>
        </div>
      )}
    </div>
  );
}

function PeopleManager({ people, onBack }: { people: Person[]; onBack: () => void }) {
  const qc = useQueryClient();
  const update = async (id: string, patch: { name?: string; active?: boolean }) => {
    const { error } = await supabase.from("people").update(patch).eq("id", id);
    if (error) toast.error("No se pudo guardar");
    void qc.invalidateQueries({ queryKey: peopleKey });
  };
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {people.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay personas.</p>}
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Input
              defaultValue={p.name}
              className={cn("h-11 text-base", !p.active && "text-muted-foreground")}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.name) void update(p.id, { name: v });
              }}
            />
            <Button variant="outline" className="h-11 shrink-0" onClick={() => void update(p.id, { active: !p.active })}>
              {p.active ? "Desactivar" : "Activar"}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="h-11" onClick={onBack}>
        Volver
      </Button>
    </div>
  );
}
