import { describe, expect, it } from "vitest";
import { floatingDiff, floatingMapping, floatingShift, parseFloatingMoney, prepareFloatingFile } from "./floating-packages";

describe("Pacotes Flutuantes source integrity", () => {
  it("reads only the named Perdidos sheet", () => {
    const result = prepareFloatingFile({ format: "xlsx", sheets: [{ name: "Outra", rows: [["BR"], ["OUTRO"]] }, { name: "  PERDIDOS  ", rows: [["BR", "Valor", "Data"], ["BR1", "R$ 1.234,56", "21/10/2026"]] }] });
    expect(result.rows.map((row) => row.order_id)).toEqual(["BR1"]);
    expect(result.rows[0].quantity).toBe(1234.56);
    expect(result.rows[0].record_date).toBe("2026-10-21");
  });
  it("rejects empty bases instead of removing the current list", () => {
    expect(() => prepareFloatingFile({ format: "xlsx", sheets: [{ name: "Perdidos", rows: [["BR"]] }] })).toThrow("vazia");
  });
  it("rejects missing Perdidos or missing BR", () => {
    expect(() => prepareFloatingFile({ format: "xlsx", sheets: [{ name: "Outra", rows: [["BR"], ["BR1"]] }] })).toThrow("não encontrada");
    expect(() => prepareFloatingFile({ format: "xlsx", sheets: [{ name: "Perdidos", rows: [["Valor"], [100]] }] })).toThrow("BR é obrigatória");
  });
  it("compares BRs as complete lists without accumulating absent packages", () => {
    expect(floatingDiff([{ order_id: "BR1" }, { order_id: "BR2" }], [{ order_id: "BR2" }, { order_id: "BR3" }])).toEqual({ new: 1, remain: 1, leave: 1 });
  });
  it("ignores identical duplicate BRs but refuses conflicting rows", () => {
    expect(prepareFloatingFile({ format: "xlsx", sheets: [{ name: "Perdidos", rows: [["BR", "Valor"], ["BR1", 10], ["BR1", 10]] }] }).rows).toHaveLength(1);
    expect(() => prepareFloatingFile({ format: "xlsx", sheets: [{ name: "Perdidos", rows: [["BR", "Valor"], ["BR1", 10], ["BR1", 20]] }] })).toThrow("dados diferentes");
  });
  it("keeps invalid monetary values uninformed", () => {
    expect(parseFloatingMoney("inválido")).toBeNull();
    expect(parseFloatingMoney(0)).toBe(0);
  });
  it("never infers shift or mapping", () => {
    expect(floatingShift(null)).toBe("Não identificado");
    expect(floatingShift("OUTRO")).toBe("Não identificado");
    expect(floatingMapping({ extra: { mapping: null } })).toBe("Não identificado");
    expect(floatingMapping({ extra: { mapping: "Recebimento" } })).toBe("Recebimento");
  });
});