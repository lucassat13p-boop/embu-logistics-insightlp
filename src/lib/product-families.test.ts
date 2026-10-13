import { describe, expect, it } from "vitest";
import { countProductFamilies, productFamily } from "./product-families";

describe("product families", () => {
  it("groups paint descriptions independent of case and accents", () => {
    for (const name of ["Tinta", "Tinta Coralar Rubi Anti Mofo", "tinta Econômica Interna 10L", "Tinta para Parede", "TINTA Acrílica"]) expect(productFamily(name)).toBe("TINTA");
  });
  it("keeps objects apart from materials, purposes and similar words", () => {
    expect(productFamily("Jarra de Vidro 1L")).toBe("JARRA");
    expect(productFamily("Espelho retangular vidro decoração")).toBe("ESPELHO");
    expect(productFamily("Pincel para tinta acrílica")).toBe("PINCEL");
    expect(productFamily("Removedor de tinta")).toBe("REMOVEDOR DE TINTA");
    expect(productFamily("Tintas acrílicas")).toBe("TINTA");
    expect(productFamily("Tintas acrílicas e Torneira")).toBe("TINTAS ACRILICAS E TORNEIRA");
    expect(productFamily("Tintagel")).toBe("TINTAGEL");
  });
  it("does not invent missing products and preserves originals", () => {
    const rows = [{ product: "Tinta acrílica" }, { product: "TINTA para Parede" }, { product: "Jarra de Vidro" }, { product: null }];
    const original = JSON.stringify(rows);
    expect(countProductFamilies(rows)).toEqual([{ name: "TINTA", value: 2 }, { name: "JARRA", value: 1 }]);
    expect(JSON.stringify(rows)).toBe(original);
    expect(productFamily(" ")).toBeNull();
  });
});