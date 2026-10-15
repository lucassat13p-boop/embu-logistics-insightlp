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