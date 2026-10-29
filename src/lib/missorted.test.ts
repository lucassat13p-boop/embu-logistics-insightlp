import { expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { INITIAL_MISSORTED_TARGET, missortedResult, validMissortedCounts } from "./missorted";

it("starts with the required 0.68 percent target", () => {
  expect(INITIAL_MISSORTED_TARGET).toBe(0.68);
});
it("106 incorrect of 10800 is above target without rounding first", () => {
  expect(missortedResult([{ incorrect_packages: 106, processed_packages: 10800 }], 0.68)).toEqual({ percent: 106 / 10800 * 100, above: true });
});
it("50 incorrect of 10800 is within target", () => {
  expect(missortedResult([{ incorrect_packages: 50, processed_packages: 10800 }], 0.68).above).toBe(false);
});
it("exactly 0.68 percent is within target", () => {
  expect(missortedResult([{ incorrect_packages: 68, processed_packages: 10000 }], 0.68).above).toBe(false);
});
it("uses summed counts rather than averaging percentages", () => {
  expect(missortedResult([{ incorrect_packages: 106, processed_packages: 10800 }, { incorrect_packages: 50, processed_packages: 100 }], 0.68).percent).toBe(156 / 10900 * 100);
});
it("has no percentage with no launch or zero processed", () => {
  expect(missortedResult([], 0.68).percent).toBeNull();
  expect(missortedResult([{ incorrect_packages: 0, processed_packages: 0 }], 0.68).percent).toBeNull();
});
it("rejects negative counts", () => {
  expect(validMissortedCounts("-1", "100")).toBe(false);
});
it("rejects incorrect counts above processed", () => {
  expect(validMissortedCounts("101", "100")).toBe(false);
});