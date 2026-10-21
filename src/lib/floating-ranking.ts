import type { RecordRow } from "./data";
import { countBy } from "./data";
import { floatingShift } from "./floating-packages";

export function floatingRankings(rows: RecordRow[], mode: string, shift: string) {
  const filtered = rows.filter((row) => shift === "all" || floatingShift(row.shift) === shift);
  if (mode === "general") return [{ shift: "all", data: countBy(filtered, "collaborator").slice(0, 10) }];
  return (shift === "all" ? ["AM1", "AM2", "PM1"] : [shift]).map((item) => ({
    shift: item,
    data: countBy(filtered.filter((row) => floatingShift(row.shift) === item), "collaborator").slice(0, 5),
  }));
}