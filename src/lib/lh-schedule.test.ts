import { describe, expect, it } from "vitest";
import { lhDisplayShift, lhFromRecord } from "./lh-schedule";
import type { RecordRow } from "./data";

describe("LH report shifts", () => {
  it("maps original AM to AM1", () => expect(lhDisplayShift("AM")).toBe("AM1"));
  it("maps original PM1 to AM2", () => expect(lhDisplayShift("PM1")).toBe("AM2"));
  it("maps original PM2 to PM1", () => expect(lhDisplayShift("PM2")).toBe("PM1"));
  it("preserves REVERSA and unknown values without assigning a shift", () => {
    expect(lhDisplayShift("REVERSA")).toBe("REVERSA");
    expect(lhDisplayShift("DESCONHECIDO")).toBe("DESCONHECIDO");
    expect(lhDisplayShift(null)).toBeNull();
    expect(lhDisplayShift(" ")).toBeNull();
  });
  it("converts existing records once per read without mutating the source or deriving from time", () => {
    const source = { id: "lh", lh: "trip", shift: "PM2", extra: { scheduled_at: "2026-10-29 02:00" } } as unknown as RecordRow;
    expect(lhFromRecord(source).shift).toBe("PM1");
    expect(lhFromRecord(source).shift).toBe("PM1");
    expect(source.shift).toBe("PM2");
    expect(lhFromRecord(source).scheduledAt).toBe("2026-10-29 02:00");
  });
});