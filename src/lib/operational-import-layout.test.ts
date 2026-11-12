import { describe, expect, it } from "vitest";
import { operationalBlockWidth, parseOperationalDate } from "./operational-import-layout";
import { buildOperationalImport } from "./operational-errors";

describe("TABELAS dated and legacy layouts", () => {
  it("recognizes legacy A–D/E–H/I–L despite absent headers and extra tables", () => {
    expect(operationalBlockWidth([["AM1", null, null, null, "AM2", null, null, null, "PM1", null, null, null, "Resumo"], []], "TABELAS")).toBe(4);
  });
  it("recognizes dated A–E/F–J/K–O despite repeated headers", () => {
    expect(operationalBlockWidth([["AM1", null, null, null, null, "AM2", null, null, null, null, "PM1"], Array(15).fill("BR")], "TABELAS")).toBe(5);
  });
  it("stops when neither layout has reliable source evidence", () => {
    expect(() => operationalBlockWidth([[], []], "TABELAS")).toThrow("segurança");
  });
  it("reads Brazilian day/month and preserves the original value", () => {
    expect(parseOperationalDate("01/02/2026")).toEqual({ iso: "2026-02-01", raw: "01/02/2026" });
  });
  it("uses the Excel calendar day without rounding fractions to the next day", () => {
    expect(parseOperationalDate(45470.99)).toEqual({ iso: "2024-06-27", raw: "45470.99" });
  });
  it("does not create dates for absent or invalid source values", () => {
    expect(parseOperationalDate(null)).toEqual({ iso: null, raw: null });
    expect(parseOperationalDate("31/02/2026")).toEqual({ iso: null, raw: "31/02/2026" });
  });
});

describe("TABELAS compatibility and source preservation", () => {
  const rows = [
    ["Aviso: preencher os erros AM1 AM2 PM1"],
    ["AM1", null, null, null, null, "AM2", null, null, null, null, "PM1", null, null, null, "AM1", "AM2", "PM1"],
    ["BR", "Login", "Erro/Motivo", "Turno", null, "BR", "Login", null, "Turno", null, "BR", "Login", "Erro/Motivo", "Turno", "Erro/Motivo", "Total geral"],
    ["BR001", "ana", "SORTING", "AM1", null, "BR002", "#N/A", "ETIQUETAGEM", "#N/A", null, "BR003", "bia", "SORTING", "AM2", "SORTING", 100],
  ];
  it("reads separated AM1/AM2/PM1 blocks past a notice, never summary totals", () => {
    const result = buildOperationalImport([{ name: "TABELAS", rows }], "xlsx");
    expect(result.headerIdx).toBe(2);
    expect(result.body.map((row) => [row.values.BR, row.values["Turno responsável"]])).toEqual([["BR001", "AM1"], ["BR002", "AM2"], ["BR003", "PM1"]]);
  });
  it("retains a valid ETIQUETAGEM occurrence with a missing login and raw #N/A", () => {
    const row = buildOperationalImport([{ name: "TABELAS", rows }], "xlsx").body[1];
    expect(row.values.Login).toBeNull();
    expect(row.values["Login original"]).toBe("#N/A");
    expect(row.values["Erro/Motivo"]).toBe("ETIQUETAGEM");
    expect(row.values["Turno original"]).toBe("#N/A");
  });
  it("records a cell/block shift conflict without changing block responsibility", () => {
    const row = buildOperationalImport([{ name: "TABELAS", rows }], "xlsx").body[2];
    expect(row.values["Turno responsável"]).toBe("PM1");
    expect(row.values["Turno original"]).toBe("AM2");
    expect(row.values["Inconsistência de turno"]).toContain("AM2 difere do bloco PM1");
  });
  it("keeps contiguous dated imports and their original individual dates", () => {
    const result = buildOperationalImport([{ name: "TABELAS", rows: [
      ["AM1", null, null, null, null, "AM2", null, null, null, null, "PM1"],
      Array.from({ length: 3 }, () => ["Data", "BR", "Login", "Erro/Motivo", "Turno"]).flat(),
      ["12/11/2026", "BR010", "ana", "SORTING", "AM1"],
    ] }], "xlsx");
    expect(result.body.map((row) => [row.values.Data, row.values.BR, row.values["Turno responsável"]])).toEqual([["12/11/2026", "BR010", "AM1"]]);
  });
});