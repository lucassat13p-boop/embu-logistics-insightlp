import { describe, expect, it } from "vitest";
import { hubShiftMarkers, interpretRecordShift, normalizeHubShift } from "./shifts";

describe("global official shift correspondence", () => {
  it("maps PM2 to AM1", () => expect(normalizeHubShift("PM2")).toBe("AM1"));
  it("maps AM to AM2", () => expect(normalizeHubShift("AM")).toBe("AM2"));
  it("keeps PM1 as PM1", () => expect(normalizeHubShift("PM1")).toBe("PM1"));
  it("preserves official values without chained conversions", () => {
    for (const shift of ["AM1", "AM2", "PM1"]) {
      expect(normalizeHubShift(shift)).toBe(shift);
      expect(normalizeHubShift(normalizeHubShift(shift))).toBe(shift);
    }
  });
  it("uses explicit original evidence without changing source fields", () => {
    const source = { module: "avaria", shift: "AM1", raw: { TURNO: "AM" }, extra: {}, record_date: "2026-11-20", collaborator: "OPS", quantity: 7 };
    const result = interpretRecordShift(source);
    expect(result.shift).toBe("AM2");
    expect(interpretRecordShift(result).shift).toBe("AM2");
    expect(source.shift).toBe("AM1");
    expect(result.record_date).toBe("2026-11-20");
    expect(result.quantity).toBe(7);
    expect(result.collaborator).toBe("OPS");
  });
  it("preserves stored official history without reliable origin", () => {
    expect(interpretRecordShift({ module: "pacotes_flutuantes", shift: "PM1", raw: {}, extra: {} }).shift).toBe("PM1");
  });
  it("does not replace time-derived shifts with unrelated raw markers", () => {
    for (const module of ["conferencia", "retidos_veiculos"]) {
      expect(interpretRecordShift({ module, shift: "AM1", raw: { Turno: "AM" }, extra: {} }).shift).toBe("AM1");
    }
  });
  it("recognizes standalone source names but retains conflicts", () => {
    expect(hubShiftMarkers("Ops PM 2")).toEqual(["AM1"]);
    expect(hubShiftMarkers("AMANDA")).toEqual([]);
    expect(hubShiftMarkers("AM PM1")).toEqual(["AM2", "PM1"]);
  });
});