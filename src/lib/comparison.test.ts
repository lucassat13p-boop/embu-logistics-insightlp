import { describe, expect, it } from "vitest";
import type { RecordRow } from "./data";
import { adjacentPairs, COMPARISON_EMPTY, metricCount, variation } from "./comparison";

describe("monthly variation", () => {
  it("calculates signed growth, decline and no change from inputs", () => {
    expect(variation(40, 30)).toMatchObject({ percent: -25, label: "-25,0%", analysis: "Queda de 25,0%" });
    expect(variation(10, 13)).toMatchObject({ percent: 30, label: "+30,0%", analysis: "Crescimento de 30,0%" });
    expect(variation(4, 4)).toMatchObject({ percent: 0, label: "0%", analysis: "Sem alteração" });
    expect(variation(4, 0).label).toBe("-100,0%");
  });
  it("never divides by zero, even when both values are zero", () => {
    expect(variation(0, 4).label).toBe("Não calculável");
    expect(variation(0, 0).percent).toBeNull();
  });
  it("does not infer missing data", () => {
    expect(variation(null, 4).analysis).toBe(COMPARISON_EMPTY);
    expect(variation(4, null).percent).toBeNull();
    expect(variation(NaN, 4).percent).toBeNull();
  });
  it("compares adjacent periods separately and preserves input order", () => {
    expect(adjacentPairs(["2026-09"])).toEqual([]);
    expect(adjacentPairs(["2026-09", "2026-10", "2026-11"])).toEqual([
      { previous: "2026-09", current: "2026-10", previousIndex: 0, currentIndex: 1 },
      { previous: "2026-10", current: "2026-11", previousIndex: 1, currentIndex: 2 },
    ]);
  });
  it("distinguishes measured zero from absent dimensions and ignores invalid shifts", () => {
    const rows = [{ shift: "AM1", classification: "Vidro" }, { shift: "am2", classification: null }] as RecordRow[];
    expect(metricCount([], "shift", "AM1", ["AM1", "AM2", "PM1"])).toBeNull();
    expect(metricCount(rows, "shift", "AM2", ["AM1", "AM2", "PM1"])).toBe(0);
    expect(metricCount(rows.slice(1), "shift", "AM2", ["AM1", "AM2", "PM1"])).toBeNull();
    expect(metricCount(rows, "classification", "SOC")).toBe(0);
    expect(metricCount(rows.slice(1), "classification", "SOC")).toBeNull();
    expect(metricCount(rows)).toBe(2);
  });
});