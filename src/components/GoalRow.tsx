import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Goal } from "@/lib/goals";
import type { GoalPatch } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function GoalRow({
  goal,
  color,
  readOnly,
  onPatch,
}: {
  goal: Goal;
  color: string;
  readOnly?: boolean | undefined;
  onPatch: (goal: Goal, patch: GoalPatch) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSaved = useRef(goal.text);

  useEffect(() => {
    if (!editing) {
      setText(goal.text);
      lastSaved.current = goal.text;
    }
  }, [goal.text, editing]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing, text]);

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  const save = (v: string) => {
    if (v === lastSaved.current) return;
    lastSaved.current = v;
    onPatch(goal, { text: v });
  };

  const textRef = useRef(text);
  textRef.current = text;
  const saveRef = useRef(save);
  saveRef.current = save;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (editingRef.current) saveRef.current(textRef.current);
    },
    [],
  );

  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
        style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`, color }}
      >
        {goal.position}
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={goal.done}
        aria-label={goal.done ? "Marcar como pendiente" : "Marcar como completada"}
        disabled={readOnly}
        onClick={() => onPatch(goal, { done: !goal.done })}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl disabled:cursor-default"
      >
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded-md border-2 transition-colors",
            !goal.done && "border-input",
          )}
          style={goal.done ? { backgroundColor: color, borderColor: color } : undefined}
        >
          {goal.done && <Check className="h-4 w-4 text-background" strokeWidth={3} />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-2">
        {editing && !readOnly ? (
          <textarea
            ref={ref}
            value={text}
            rows={1}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => save(v), 800);
            }}
            onBlur={() => {
              clearTimeout(timer.current);
              save(text);
              setEditing(false);
            }}
            className="block w-full resize-none overflow-hidden rounded-lg bg-muted px-2 py-1 -mx-2 -my-1 text-base leading-relaxed outline-none ring-2 ring-ring/40"
          />
        ) : (
          <p
            onClick={() => !readOnly && setEditing(true)}
            className={cn(
              "whitespace-pre-wrap break-words text-base leading-relaxed",
              !readOnly && "cursor-text",
              goal.done && "text-muted-foreground line-through decoration-1",
              !goal.text && "italic text-muted-foreground",
            )}
          >
            {goal.text || (readOnly ? "—" : "Toca para escribir…")}
          </p>
        )}
      </div>
    </li>
  );
}
