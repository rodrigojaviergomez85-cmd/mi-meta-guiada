import { useSaveStatus } from "@/lib/hooks";

export function SaveIndicator() {
  const s = useSaveStatus();
  if (s === "idle") return null;
  const text = s === "saving" ? "Guardando…" : s === "saved" ? "Guardado ✓" : "Sin conexión — reintentando";
  return (
    <span
      aria-live="polite"
      className={
        "rounded-full px-3 py-1 text-xs font-medium " +
        (s === "error" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")
      }
    >
      {text}
    </span>
  );
}
