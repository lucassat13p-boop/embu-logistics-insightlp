import { describe, expect, it } from "vitest";
import { operationalBlockWidth, parseOperationalDate } from "./operational-import-layout";

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