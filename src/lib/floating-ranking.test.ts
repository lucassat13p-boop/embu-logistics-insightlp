import { expect, it } from "vitest";
import type { RecordRow } from "./data";
import { floatingRankings } from "./floating-ranking";

const rows = Array.from({ length: 12 }, (_, i) => ({ collaborator: `Pessoa ${i}`, shift: "AM1" } as RecordRow));
rows.push({ collaborator: "Pessoa 0", shift: "AM2" } as RecordRow);

it("limits the general ranking to ten collaborators", () => {
  const result = floatingRankings(rows, "general", "all");
  expect(result[0].data).toHaveLength(10);
  expect(result[0].data[0]).toEqual({ name: "Pessoa 0", value: 2 });
});
it("keeps three independent top-five shift rankings", () => {
  const result = floatingRankings(rows, "shift", "all");
  expect(result.map((r) => r.shift)).toEqual(["AM1", "AM2", "PM1"]);
  expect(result[0].data).toHaveLength(5);
  expect(result[0].data[0].value).toBe(1);
  expect(result[1].data).toEqual([{ name: "Pessoa 0", value: 1 }]);
  expect(result[2].data).toEqual([]);
});
it("shows only the selected shift with its own top-five limit", () => {
  const result = floatingRankings(rows, "shift", "AM1");
  expect(result).toHaveLength(1);
  expect(result[0].shift).toBe("AM1");
  expect(result[0].data).toHaveLength(5);
});