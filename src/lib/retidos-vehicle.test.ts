import { describe, expect, it } from "vitest";
import { retidosVehicleDivergence } from "./retidos-vehicle";

describe("Retidos vehicle comparison", () => {
  it("treats FIORINO and FIORINO ADESIVADA as equivalent, including mixed original spellings", () => {
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: "FIORINO ADESIVADA" }])).toBe("nao");
    expect(retidosVehicleDivergence([{ perfil: "FIORINO ADESIVADA", modelo: "FIORINO" }])).toBe("nao");
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: "FIORINO" }, { perfil: "FIORINO", modelo: "FIORINO ADESIVADA" }])).toBe("na");
  });
  it("does not add unconfirmed equivalences", () => {
    expect(retidosVehicleDivergence([{ perfil: "HR", modelo: "VUC" }])).toBe("sim");
  });
  it("keeps missing and conflicting vehicles unclassified", () => {
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: null }])).toBe("nao_identificado");
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: "FIORINO" }, { perfil: "HR", modelo: "HR" }])).toBe("nao_identificado");
  });
});