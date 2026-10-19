import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type ImportCacheChange = { module: string; batchId: string; treatedChanged?: boolean };

/** Preserve aggregate readers while leaving unrelated modules and settings fresh. */
export function isImportQueryAffected(key: QueryKey, change: ImportCacheChange): boolean {
  switch (key[0]) {
    case "records":
      return key[1] === "all" || key[1] === change.module;
    case "batches":
      return true;
    case "batch":
      return key[1] === change.batchId;
    case "import_errors":
      return key[1] === "all" || key[1] === change.batchId;
    case "search":
      return key[2] === "all" || key[2] === change.module;
    case "on_hold_treated_imports":
    case "official_treatments":
      return change.treatedChanged === true;
    default:
      return false;
  }
}

export function invalidateImportQueries(client: QueryClient, change: ImportCacheChange) {
  return client.invalidateQueries({ predicate: (query) => isImportQueryAffected(query.queryKey, change) });
}