import type { Sheet } from "./parsers";
import type { RecordRow } from "./data";

/** Normalize header / sheet names only for comparison. */
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s && s !== "-" ? s : null; };

/** Excel serial or text → wall-clock "YYYY-MM-DD HH:MM" (no timezone shift). */
export function toWallClock(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400) * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4].padStart(2, "0")}:${m[5]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")} ${m[4].padStart(2, "0")}:${m[5]}`;
  return null;
}
const minutes = (w: string) => { const [d, t] = w.split(" "); return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 60000 + +t.slice(0, 2) * 60 + +t.slice(3, 5); };

function findSheet(sheets: Sheet[], name: string) { return sheets.find((s) => norm(s.name) === norm(name)); }
function headerIndex(rows: unknown[][], wanted: string[]) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const h = (rows[r] ?? []).map(norm);
    const idx = Object.fromEntries(wanted.map((w) => [w, h.indexOf(norm(w))]));
    if (Object.values(idx).filter((i) => i >= 0).length >= Math.ceil(wanted.length / 2)) return { row: r, idx };
  }
  return null;
}

export type LhRow = { lh: string; origin: string | null; driver: string | null; plate: string | null; shift: string | null; scheduledAt: string | null; arrivedAt: string | null; arrived: boolean; orders: number | null };
export type LhPrepared = { rows: LhRow[]; sheetNames: string[]; duplicates: number; arrivalSource: string[]; headers: string[] };

const isHub = (station: string | null) => !!station && norm(station).includes("embu");

export function prepareLhFile(sheets: Sheet[]): LhPrepared {
  const sheetNames = sheets.map((s) => s.name);
  const main = findSheet(sheets, "LTS PENDENTES A CHEGAR");
  if (!main) throw new Error(`Aba "LTS PENDENTES A CHEGAR" não encontrada. Abas detectadas: ${sheetNames.map((n) => `"${n}"`).join(", ") || "nenhuma"}.`);
  const cols = ["Data/Hora", "LH", "Turno", "Nome Motorista", "Placa Veiculo", "Station Name"];
  const h = headerIndex(main.rows, cols);
  if (!h || h.idx["LH"] < 0) throw new Error('Cabeçalho "LH" não encontrado na aba "LTS PENDENTES A CHEGAR".');
  const get = (r: unknown[], c: string) => (h.idx[c] >= 0 ? r[h.idx[c]] : null);

  // Real arrival evidence: SPX (Importar) Actual Arrival Time at the Embu HUB station.
  const arrivals = new Map<string, string>();
  const orders = new Map<string, number>();
  const arrivalSource: string[] = [];
  const spx = findSheet(sheets, "SPX (Importar)");
  if (spx) {
    const sh = headerIndex(spx.rows, ["LH Trip Number", "Station Name", "Actual Arrival Time", "Outbound(order)"]);
    if (sh && sh.idx["LH Trip Number"] >= 0) {
      arrivalSource.push(spx.name);
      for (const r of spx.rows.slice(sh.row + 1)) {
        const lh = clean(r[sh.idx["LH Trip Number"]]); if (!lh) continue;
        const station = clean(r[sh.idx["Station Name"]]);
        if (isHub(station) && sh.idx["Actual Arrival Time"] >= 0) { const a = toWallClock(r[sh.idx["Actual Arrival Time"]]); if (a) arrivals.set(lh, a); }
        if (!isHub(station) && sh.idx["Outbound(order)"] >= 0) { const n = Number(r[sh.idx["Outbound(order)"]]); if (Number.isFinite(n) && n > 0) orders.set(lh, (orders.get(lh) ?? 0) + n); }
      }
    }
  }
  // Secondary evidence: "Arrived" status on the LHs sheet (no time available there).
  const arrivedStatus = new Set<string>();
  const lhs = findSheet(sheets, "LHs");
  if (lhs) {
    arrivalSource.push(lhs.name);
    for (const r of lhs.rows) { const lh = clean(r[0]); if (lh && r.some((c) => norm(c) === "arrived")) arrivedStatus.add(lh); }
  }

  const seen = new Map<string, LhRow>();
  let duplicates = 0;
  for (const r of main.rows.slice(h.row + 1)) {
    const lh = clean(get(r, "LH")); if (!lh) continue;
    if (seen.has(lh)) { duplicates++; continue; }
    const arrivedAt = arrivals.get(lh) ?? null;
    seen.set(lh, {
      lh, origin: clean(get(r, "Station Name")), driver: clean(get(r, "Nome Motorista")), plate: clean(get(r, "Placa Veiculo")),
      shift: clean(get(r, "Turno")), scheduledAt: toWallClock(get(r, "Data/Hora")), arrivedAt,
      arrived: !!arrivedAt || arrivedStatus.has(lh), orders: orders.get(lh) ?? null,
    });
  }
  const rows = [...seen.values()].sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9"));
  return { rows, sheetNames, duplicates, arrivalSource, headers: (main.rows[h.row] ?? []).map((c) => String(c ?? "")) };
}

export type LhView = LhRow & { id: string };
export function lhFromRecord(r: RecordRow): LhView {
  const e = (r.extra ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof e[k] === "string" ? (e[k] as string) : null);
  return { id: r.id, lh: r.lh ?? "", origin: r.route, driver: r.driver_name, plate: s("plate"), shift: r.shift, scheduledAt: s("scheduled_at"), arrivedAt: s("arrived_at"), arrived: r.status === "Chegou", orders: typeof e.orders === "number" ? e.orders : null };
}
/** Minutes late (>0) or early (<0); null when no real arrival time. */
export function arrivalDelta(r: LhRow) { return r.arrivedAt && r.scheduledAt ? minutes(r.arrivedAt) - minutes(r.scheduledAt) : null; }
export const driverName = (d: string | null) => d?.replace(/^\[\d+\]\s*/, "") ?? null;
export const fmtWall = (w: string | null) => (w ? `${w.slice(8, 10)}/${w.slice(5, 7)} ${w.slice(11)}` : "Sem informação");
