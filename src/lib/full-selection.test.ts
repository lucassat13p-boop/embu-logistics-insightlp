import { describe, expect, it } from "vitest";
import type { RecordRow } from "./data";
import { fullBrList, fullManualError, fullSelectionScope } from "./full-selection";

const row = (id: string, options: Partial<RecordRow> = {}) => ({ id, module: "full", order_id: "BR123", record_date: "2026-10-19", shift: "AM1", batch_id: "batch", manual_status: null, ...options }) as RecordRow;

describe("FULL selection rules", () => {
  it("rejects empty manual classification", () => expect(fullManualError("  ")).not.toBeNull());
  it("rejects LMHub_Received justification", () => expect(fullManualError("LMHub_Received")).not.toBeNull());
  it("does not reject Return_LMHub_Received", () => expect(fullManualError("Return_LMHub_Received")).toBeNull());
  it("links TOs only inside the same operational date and shift", () => {
    const scope = fullSelectionScope([row("a"), row("b", { to_number: "TO2" }), row("c", { shift: "PM1" }), row("d", { record_date: "2026-10-18" })], new Set(["a"]), false);
    expect(scope.affected.map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("preserves whole manually classified groups by default", () => {
    expect(fullSelectionScope([row("a"), row("b", { manual_status: "Backlog" })], new Set(["a"]), false).affected).toHaveLength(0);
  });
  it("allows explicit overwrite of manual classifications", () => {
    expect(fullSelectionScope([row("a"), row("b", { manual_status: "Backlog" })], new Set(["a"]), true).affected).toHaveLength(2);
  });
  it("copies unique complete nonempty BRs only", () => {
    expect(fullBrList([row("a"), row("b"), row("c", { order_id: "" }), row("d", { order_id: "BR456789000" })])).toEqual(["BR123", "BR456789000"]);
  });
});