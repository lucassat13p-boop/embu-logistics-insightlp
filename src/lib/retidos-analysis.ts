import type { RecordRow } from "./data";
import { cellText } from "./parsers";
import { recordMonth, type PeriodSelection } from "./period";

/** Parse wall-clock values without converting the operational timezone. */
export function parseRetidosTime(value: unknown): { date: string | null; minutes: number | null } {
  const raw = cellText(value);
  if (!raw) return { date: null, minutes: null };
  if (typeof value === "number" || /^\d{4,5}(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 80000) {
      const date = new Date(Math.floor(serial - 25569) * 86400000).toISOString().slice(0, 10);
      const seconds = Math.round((serial - Math.floor(serial)) * 86400);
      return { date, minutes: seconds < 86400 ? Math.floor(seconds / 60) : 1439 };
    }
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  const br = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
  const match = iso ?? br;
  if (!match) return { date: null, minutes: null };
  const year = iso ? match[1] : match[3];
  const month = match[2];
  const day = iso ? match[3] : match[1];
  if (!year || !month || !day) return { date: null, minutes: null };
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!recordMonth(date)) return { date: null, minutes: null };
  if (match[4] === undefined) return { date, minutes: null };
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return { date: null, minutes: null };
  return { date, minutes: hour * 60 + minute };
}

export const RETIDOS_SHIFTS = ["AM1", "AM2", "PM1"] as const;
/** Presentation only: the first recognized reason is primary; source text stays intact. */
export function summarizedRetidosReason(value: unknown): string | null {
  const text = cellText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!text.trim()) return null;
  const rules = [
    { name: "Etiqueta avariada", pattern: /\betiqueta\s+(?:avariada|danificada)\b|\bdamaged\s+label\b/ },
    { name: "Pacote não coube", pattern: /\bpacote\s+nao\s+coube\b|\bnao\s+coube\s+no\s+veiculo\b/ },
    { name: "Network Exception", pattern: /\bnetwork\s+exception\b/ },
    { name: "Misroute", pattern: /\bmisroute\b/ },
    { name: "Start Return", pattern: /\bstart\s+return\b/ },
    { name: "Avaria", pattern: /\bavaria(?:s)?\b|\bdamaged\b/ },
    { name: "Exceção", pattern: /\bexcecao\b|\bexception\b/ },
  ];
  let primary: { name: string; index: number } | null = null;
  for (const rule of rules) {
    const match = rule.pattern.exec(text);
    if (!match) continue;
    // Do not reclassify words inside a more specific matched phrase.
    if (rules.some((specific) => specific !== rule && (specific.name === "Etiqueta avariada" || specific.name === "Network Exception") && (() => {
      const phrase = specific.pattern.exec(text);
      return phrase !== null && match.index >= phrase.index && match.index < phrase.index + phrase[0].length;
    })())) continue;
    if (primary === null || match.index < primary.index) primary = { name: rule.name, index: match.index };
  }
  return primary?.name ?? "Outros";
}

export function countRetidosReasons(rows: RecordRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = summarizedRetidosReason(row.reason);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}

export function retidosVehicle(row: RecordRow): string | null {
  if (!row.raw || typeof row.raw !== "object" || Array.isArray(row.raw)) return null;
  for (const [key, value] of Object.entries(row.raw)) {
    const header = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (["veiculo", "vehicle", "vehicle number", "vehicle id", "placa", "placa do veiculo"].includes(header)) {
      return cellText(value) || null;
    }
  }
  return null;
}
export type RetidosShift = (typeof RETIDOS_SHIFTS)[number];
export function retidosShift(row: RecordRow): RetidosShift | null {
  const { minutes } = parseRetidosTime(row.create_time);
  if (minutes === null) return null;
  if (minutes >= 1260 || minutes < 300) return "AM1";
  if (minutes >= 300 && minutes <= 690) return "AM2";
  if (minutes >= 720 && minutes <= 1070) return "PM1";
  return null;
}
export function filterRetidosShifts(rows: RecordRow[], shifts: RetidosShift[]): RecordRow[] {
  if (!shifts.length || RETIDOS_SHIFTS.every((shift) => shifts.includes(shift))) return rows;
  return rows.filter((row) => { const shift = retidosShift(row); return shift !== null && shifts.includes(shift); });
}
export function retidosEvolution(rows: RecordRow[], period: PeriodSelection) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const { date, minutes } = parseRetidosTime(row.create_time);
    if (!date) continue;
    if (period.kind === "day" && minutes === null) continue;
    const key = period.kind === "day" ? `${date} ${String(Math.floor((minutes ?? 0) / 60)).padStart(2, "0")}:00` : date;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}