import { expect, it } from "vitest";
import type { RecordRow } from "./data";
import { errorLoginRankingRows } from "./error-login-ranking";

it("excludes absent and placeholder logins by default while preserving valid rows", () => {
  const valid = { collaborator: "Pessoa real" } as RecordRow;
  const rows = [null, "", "   ", "#N/A", "n/a", "null", "undefined", "Sem informação", "Nenhum dado disponível", "Não identificado"].map((collaborator) => ({ collaborator } as RecordRow));
  expect(errorLoginRankingRows([...rows, valid], false)).toEqual([valid]);
});

it("includes every missing-login occurrence under one group without modifying sources", () => {
  const rows = [null, "#N/A", "N/A"].map((collaborator) => ({ collaborator } as RecordRow));
  const result = errorLoginRankingRows(rows, true);
  expect(result).toHaveLength(3);
  expect(new Set(result.map((row) => row.collaborator)).size).toBe(1);
  expect(rows.map((row) => row.collaborator)).toEqual([null, "#N/A", "N/A"]);
});