import { describe, expect, it } from "vitest";
import { countRetidosRealizedVehicles, retidosVehicleDivergence } from "./retidos-vehicle";

describe("Retidos vehicle comparison", () => {
  const occurrence = (model: string | null, match = "ok", cluster: string | null = "A1") => ({ extra: { route_match: match, route_cluster: cluster, route_modelo: model, route_perfil: "MOTO" } });
  it("counts realized MOTO, not the planned vehicle", () => {
    expect(countRetidosRealizedVehicles([occurrence("MOTO"), occurrence("PASSEIO")]).counts.MOTO).toBe(1);
  });
  it("includes FIORINO ADESIVADA in FIORINO", () => {
    expect(countRetidosRealizedVehicles([occurrence("FIORINO"), occurrence("FIORINO ADESIVADA")]).counts.FIORINO).toBe(2);
  });
  it("counts PASSEIO without assigning other models to it", () => {
    expect(countRetidosRealizedVehicles([occurrence("PASSEIO"), occurrence("HR")]).counts.PASSEIO).toBe(1);
  });
  it("preserves repeated source occurrences without multiplying their route matches", () => {
    const row = occurrence("MOTO");
    expect(countRetidosRealizedVehicles([row, row]).counts.MOTO).toBe(2);
  });
  it("does not infer vehicles for unresolved routes or missing models", () => {
    expect(countRetidosRealizedVehicles([occurrence("MOTO", "ambigua"), occurrence("MOTO", "nao_identificada"), occurrence("MOTO", "ok", null), occurrence(null), { extra: null }])).toEqual({ counts: { MOTO: 0, FIORINO: 0, PASSEIO: 0 }, identified: 0 });
  });
  it("treats FIORINO and FIORINO ADESIVADA as equivalent, including mixed original spellings", () => {
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: "FIORINO ADESIVADA" }])).toBe("nao");
    expect(retidosVehicleDivergence([{ perfil: "FIORINO ADESIVADA", modelo: "FIORINO" }])).toBe("nao");
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: "FIORINO" }, { perfil: "FIORINO", modelo: "FIORINO ADESIVADA" }])).toBe("nao");
  });
  it("does not add unconfirmed equivalences", () => {
    expect(retidosVehicleDivergence([{ perfil: "HR", modelo: "VUC" }])).toBe("sim");
  });
  it("keeps missing and conflicting vehicles unclassified", () => {
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: null }])).toBe("nao_identificado");
    expect(retidosVehicleDivergence([{ perfil: "FIORINO", modelo: "FIORINO" }, { perfil: "HR", modelo: "HR" }])).toBe("nao_identificado");
  });
});