import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateImportQueries, isImportQueryAffected } from "./import-cache";

const change = { module: "avaria", batchId: "new-batch" };

describe("import-scoped freshness", () => {
  it("refreshes the imported module and aggregate records, not another module", () => {
    expect(isImportQueryAffected(["records", "avaria"], change)).toBe(true);
    expect(isImportQueryAffected(["records", "all"], change)).toBe(true);
    expect(isImportQueryAffected(["records", "full"], change)).toBe(false);
  });

  it("refreshes shared history and linked errors without touching unrelated details", () => {
    expect(isImportQueryAffected(["batches"], change)).toBe(true);
    expect(isImportQueryAffected(["batch", "new-batch"], change)).toBe(true);
    expect(isImportQueryAffected(["import_errors", "new-batch"], change)).toBe(true);
    expect(isImportQueryAffected(["import_errors", "all"], change)).toBe(true);
    expect(isImportQueryAffected(["batch", "old-batch"], change)).toBe(false);
    expect(isImportQueryAffected(["import_errors", "old-batch"], change)).toBe(false);
  });

  it("refreshes matching and global search only", () => {
    expect(isImportQueryAffected(["search", "BR", "all"], change)).toBe(true);
    expect(isImportQueryAffected(["search", "BR", "avaria"], change)).toBe(true);
    expect(isImportQueryAffected(["search", "BR", "full"], change)).toBe(false);
  });

  it("refreshes official ON HOLD totals only after the secondary save succeeds", () => {
    for (const key of [["on_hold_treated_imports"], ["official_treatments"]]) {
      expect(isImportQueryAffected(key, { module: "on_hold", batchId: "new-batch" })).toBe(false);
      expect(isImportQueryAffected(key, { module: "on_hold", batchId: "new-batch", treatedChanged: true })).toBe(true);
    }
    expect(isImportQueryAffected(["operational_treatments"], { ...change, treatedChanged: true })).toBe(false);
    expect(isImportQueryAffected(["mappings"], change)).toBe(false);
    expect(isImportQueryAffected(["import-deletion-user"], change)).toBe(false);
  });

  it("reduces active refetches while preserving affected and inactive-reader freshness", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const keys = [["records", "avaria"], ["records", "full"], ["records", "on_hold"], ["batches"]];
    const calls = keys.map(() => 0);
    const observers = keys.map((queryKey, index) => new QueryObserver(client, {
      queryKey,
      queryFn: async () => ++calls[index],
    }));
    const unsubscribers = observers.map((observer) => observer.subscribe(() => {}));
    try {
      await Promise.all(observers.map((observer) => observer.refetch()));
      client.setQueryData(["search", "BR", "all"], []);
      const before = [...calls];
      await client.invalidateQueries();
      expect(calls.map((value, index) => value - before[index])).toEqual([1, 1, 1, 1]);
      const scopedBefore = [...calls];
      await invalidateImportQueries(client, change);
      expect(calls.map((value, index) => value - scopedBefore[index])).toEqual([1, 0, 0, 1]);
      expect(client.getQueryState(["search", "BR", "all"])?.isInvalidated).toBe(true);
      expect(client.getQueryState(["records", "full"])?.isInvalidated).toBe(false);
    } finally {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      client.clear();
    }
  });
});