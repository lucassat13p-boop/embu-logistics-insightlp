import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { countTreatedSheet } from "./on-hold-treated";

describe("ON HOLD treated-package counting", () => {
  it("counts all 106 unique tracking numbers regardless of secondary fields", () => {
    const rows: unknown[][] = [
      ["ID", "SLS Tracking Number", "OnHoldReason", "Status", "Calculation Status"],
      ...Array.from({ length: 106 }, (_, i) => [i + 1, `BR${100000 + i}`, "Other reason", "Other status", 1]),
    ];
    const result = countTreatedSheet([{ name: "Pacotes Tratados  Não MEXER", rows }]);
    expect(result).toMatchObject({ analyzed: 106, matched: 106 });
  });

  it("ignores empty, invalid and duplicate tracking codes within the sheet", () => {
    const result = countTreatedSheet([{
      name: "Pacotes Tratados Não MEXER",
      rows: [["ID", "SLS Tracking Number"], [1, "BR123456"], [2, " br123456 "], [3, ""], [4, "#N/A"], [5, "Sem informação"], [6, "BR654321"]],
    }]);
    expect(result).toMatchObject({ analyzed: 6, matched: 2 });
  });

  it("requires the tracking header in column B of the first row", () => {
    const result = countTreatedSheet([{
      name: "Pacotes Tratados Não MEXER",
      rows: [["SLS Tracking Number", "Status"], ["BR123456", "LMHub_Received"]],
    }]);
    expect("error" in result).toBe(true);
  });
});