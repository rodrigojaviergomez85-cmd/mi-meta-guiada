import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Numbered badge; when movable, tapping it lets the user pick a new position in the list. */
export function PositionBadge({
  position,
  total,
  onMove,
  className,
  style,
}: {
  position: number;
  total: number;
  onMove?: ((to: number) => void) | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const badge = (
    <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold", className)} style={style}>
      {position}
    </span>
  );
  if (!onMove || total < 2) return <span className="mt-2.5 shrink-0">{badge}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Cambiar orden (posición ${position})`} className="-m-2.5 grid h-11 w-11 shrink-0 place-items-center">
          {badge}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Mover a posición</DropdownMenuLabel>
        <DropdownMenuItem className="min-h-11" disabled={position === 1} onClick={() => onMove(position - 1)}>
          <ArrowUp className="mr-2 h-4 w-4" /> Subir
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" disabled={position === total} onClick={() => onMove(position + 1)}>
          <ArrowDown className="mr-2 h-4 w-4" /> Bajar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <DropdownMenuItem key={n} className="min-h-11" disabled={n === position} onClick={() => onMove(n)}>
            {n === 1 ? "1 · Primera" : n === total ? `${n} · Última` : n}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Returns the new position for an item at `pos` after moving the item at `from` to `to`. */
export function shiftedPosition(pos: number, from: number, to: number) {
  if (pos === from) return to;
  if (from < to && pos > from && pos <= to) return pos - 1;
  if (from > to && pos >= to && pos < from) return pos + 1;
  return pos;
}
