import { supabase } from "@/integrations/supabase/client";
import { flush } from "./goals";
import { flushBtm } from "./btm";

const COMPANY: Record<string, string> = { personal: "Personal", e4cc: "E4CC", e4kids: "E4Kids" };
const LEVEL: Record<string, string> = { annual: "Anual", monthly: "Mensual", weekly: "Semanal" };

async function all<T>(table: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .order(order)
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

/** Downloads an Excel file with all of the user's data (one sheet per area). */
export async function downloadBackup() {
  await Promise.allSettled([flush(), flushBtm()]);
  const [snaps, goals, people, comments, issues, days, prios, blocks, ideas] = await Promise.all([
    all<R>("snapshots", "created_at"),
    all<R>("goals", "position"),
    all<R>("people", "name"),
    all<R>("goal_comments", "created_at"),
    all<R>("company_issue_items", "position"),
    all<R>("btm_days", "day"),
    all<R>("btm_priorities", "ref_date"),
    all<R>("btm_blocks", "day"),
    all<R>("ideas", "idea_date"),
  ]);
  const XLSX = await import("xlsx");
  const snapById = new Map(snaps.map((s) => [s.id, s]));
  const personById = new Map(people.map((p) => [p.id, p.name]));
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const week = (id: string) => snapById.get(id)?.label ?? "";
  const sortSnap = (a: R, b: R) => String(snapById.get(b.snapshot_id)?.snapshot_date).localeCompare(String(snapById.get(a.snapshot_id)?.snapshot_date));

  const sheets: [string, R[]][] = [
    ["Semanas", [...snaps].sort((a, b) => String(b.snapshot_date).localeCompare(a.snapshot_date)).map((s) => ({
      Etiqueta: s.label, "Núm. semana": s.week_number ?? "", Semana: s.week_label, Mes: s.month_label, Anual: s.annual_label,
      Inicio: s.week_start ?? "", Fin: s.week_end ?? "", Actual: s.is_current ? "Sí" : "",
    }))],
    ["Metas", [...goals].sort((a, b) => sortSnap(a, b) || a.company.localeCompare(b.company) || a.level.localeCompare(b.level) || a.position - b.position).map((g) => ({
      Semana: week(g.snapshot_id), Empresa: COMPANY[g.company], Nivel: LEVEL[g.level], "#": g.position, Meta: g.text,
      Completada: g.done ? "Sí" : "No", Responsable: g.assignee_id ? personById.get(g.assignee_id) ?? "" : "",
    }))],
    ["Comentarios", comments.map((c) => {
      const g = goalById.get(c.goal_id);
      return { Semana: g ? week(g.snapshot_id) : "", Empresa: g ? COMPANY[g.company] : "", Meta: g?.text ?? "", Comentario: c.body, Fecha: new Date(c.created_at).toLocaleString("es") };
    })],
    ["Issues", [...issues].sort((a, b) => sortSnap(a, b) || a.company.localeCompare(b.company) || a.position - b.position).map((i) => ({
      Semana: week(i.snapshot_id), Empresa: COMPANY[i.company], "#": i.position, Texto: i.text,
    }))],
    ["BTM Prioridades", prios.map((p) => ({
      Tipo: p.scope === "week" ? "Semana" : "Día", Fecha: p.ref_date, Prioridad: `A${p.position}`, Actividad: p.text,
      Minutos: p.minutes ?? "", Completada: p.done ? "Sí" : "No",
    }))],
    ["BTM Agenda", [...blocks].sort((a, b) => a.day.localeCompare(b.day) || a.start_time.localeCompare(b.start_time)).map((b) => ({
      Fecha: b.day, Inicio: b.start_time.slice(0, 5), Fin: b.end_time.slice(0, 5), Actividad: b.activity,
    }))],
    ["BTM Seguimiento", days.filter((d) => d.follow_up.trim()).map((d) => ({ Fecha: d.day, Seguimiento: d.follow_up }))],
    ["Ideas", [...ideas].reverse().map((i) => ({ Fecha: i.idea_date, Categoría: ({ personal: "Personal", e4kids: "E4Kids", e4cc: "E4CC", otros: "Otros" } as R)[i.category], Idea: i.text, Tabla: Array.isArray(i.table_data) ? i.table_data.map((r: string[]) => r.join(" | ")).join("\n") : "", Hecha: i.done ? "Sí" : "No" }))],
    ["Personas", people.map((p) => ({ Nombre: p.name, Activa: p.active ? "Sí" : "No" }))],
  ];

  const wb = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["Sin datos"]]);
    if (rows.length) ws["!cols"] = Object.keys(rows[0]!).map((k) => ({ wch: Math.min(60, Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(wb, `Mi411-respaldo-${stamp}.xlsx`);
}
