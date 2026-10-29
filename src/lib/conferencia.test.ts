import { expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { auditFromRecord, auditRanking, auditShift, meanDuration } from "./conferencia";
import type { RecordRow } from "./data";
const row = (route: string, start: string, end: string | null) => auditFromRecord({ id: route, route, create_time: start, resolve_time: end, raw: { "Validation Operator": "[ops1]Pessoa", "Revalidation Operator": "[ops2]Outra pessoa" } } as RecordRow);
it("assigns late AM1 to next operational date and early AM1 to its own date", () => {
  expect(auditShift("2026-10-27 22:00:00")).toEqual({ shift: "AM1", date: "2026-10-28" });
  expect(auditShift("2026-10-28 02:30:00")).toEqual({ shift: "AM1", date: "2026-10-28" });
});
it("keeps second-precise shift boundaries and gaps", () => {
  for (const [time, shift] of [["04:30:00", "AM1"], ["04:30:01", "Fora de turno"], ["05:00:00", "AM2"], ["12:00:00", "AM2"], ["12:00:01", "Fora de turno"], ["12:04:59", "Fora de turno"], ["12:05:00", "PM1"], ["20:00:00", "PM1"], ["20:00:01", "Fora de turno"], ["20:59:59", "Fora de turno"], ["21:00:00", "AM1"]]) expect(auditShift(`2026-10-28 ${time}`).shift).toBe(shift);
});
it("calculates duration across midnight without invalid or negative durations", () => {
  const valid = row("AT1", "2026-10-27 23:58:00", "2026-10-28 00:06:21");
  expect(valid.duration).toBe(501);
  expect(meanDuration([valid, row("AT2", "2026-10-28 01:00:00", null), row("AT3", "2026-10-28 01:00:00", "2026-10-28 00:00:00")])).toBe(501);
});
it("requires three distinct routes only for speed ranking", () => {
  const two = [row("AT1", "2026-10-28 01:00:00", "2026-10-28 01:01:00"), row("AT2", "2026-10-28 01:00:00", "2026-10-28 01:01:00")];
  expect(auditRanking(two, true)).toHaveLength(0);
  expect(auditRanking(two)).toHaveLength(1);
  expect(auditRanking([...two, row("AT3", "2026-10-28 01:00:00", "2026-10-28 01:01:00")], true)).toHaveLength(1);
});
it("attributes validation to its original operator, not revalidation", () => {
  expect(row("AT1", "2026-10-28 01:00:00", null).operator).toEqual({ key: "ops1", login: "ops1", name: "Pessoa", label: "Pessoa" });
});