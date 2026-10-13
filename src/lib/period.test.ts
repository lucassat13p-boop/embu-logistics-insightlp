import { describe, expect, it } from "vitest";
import { availableMonths, filterByMonths, monthLabel, recordMonth } from "./period";

describe("real date monthly analysis", () => {
  it("rejects absent, invalid and noncanonical dates", () => {
    for (const date of [null, "", "2026-02-30", "2026-13-01", "13/10/2026"]) expect(recordMonth(date)).toBeNull();
    expect(recordMonth("2024-02-29")).toBe("2024-02");
  });
  it("uses dates only and keeps different years separate", () => {
    const rows = [{ record_date: "2025-10-01", month: "Fevereiro" }, { record_date: "2026-10-01", month: "Fevereiro" }, { record_date: null, month: "Outubro" }];
    expect(availableMonths(rows)).toEqual(["2025-10", "2026-10"]);
    expect(filterByMonths(rows, ["2026-10"])).toEqual([rows[1]]);
    expect(filterByMonths(rows, [])).toBe(rows);
    expect(rows[0].month).toBe("Fevereiro");
  });
  it("unions multiple months, excludes undated rows and supports empty periods", () => {
    const rows = [{ record_date: "2026-02-01" }, { record_date: "2026-10-13" }, { record_date: "2026-03-01" }, { record_date: null }];
    expect(filterByMonths(rows, ["2026-02", "2026-10"])).toEqual(rows.slice(0, 2));
    expect(filterByMonths(rows, ["2026-01"])).toEqual([]);
    expect(monthLabel("2026-10")).toBe("Outubro de 2026");
  });
});