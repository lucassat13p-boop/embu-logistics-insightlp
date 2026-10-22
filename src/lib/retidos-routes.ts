import { cellText, type Sheet } from "./parsers";

/** Route cross-reference for RETIDOS DE VEÍCULOS XLSX imports.
 *  PACOTES RETIRADOS (BR via SPX Tracking Number) → romaneio (SPX TN → Planned AT)
 *  → Plano de expedição (AT / TO → Cluster, Perfil, MODELO).
 *  PERFIL = veículo programado; MODELO = veículo que realmente veio.
 *  Nothing is invented: unmatched BRs/ATs stay "não identificada", multiple
 *  distinct matches stay "ambígua". */

export type RetidosRouteMatch = "ok" | "nao_identificada" | "ambigua";
export type RetidosRouteInfo = {
  match: RetidosRouteMatch;
  at: string | null;
  cluster: string | null;
  perfil: string | null;
  modelo: string | null;
};

type RouteTriple = { cluster: string | null; perfil: string | null; modelo: string | null };

export type RetidosAux = {
  sheetNames: string[];
  romaneioSheet: string | null;
  planoSheet: string | null;
  missing: string[];
  warnings: string[];
  brToAts: Map<string, Set<string>>;
  atToRoutes: Map<string, Map<string, RouteTriple>>;
  /** true only when BOTH auxiliary sheets were found with their required headers. */
  hasAny: boolean;
};

/** Comparison-only key: removes accents, case, spaces and separators. */
const nameKey = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const norm = (v: unknown) => cellText(v) ?? "";
/** Identifier key for BRs and ATs: uppercase, no whitespace. */
const normId = (v: unknown) => norm(v).toUpperCase().replace(/\s+/g, "");

function findSheet(sheets: Sheet[], targets: string | string[]): Sheet | undefined {
  const keys = (Array.isArray(targets) ? targets : [targets]).map(nameKey);
  for (const key of keys) { const s = sheets.find((x) => nameKey(x.name) === key); if (s) return s; }
  for (const key of keys) { const s = sheets.find((x) => nameKey(x.name).includes(key)); if (s) return s; }
  return undefined;
}
/** Accepted sheet names: new layout first, then legacy names. */
const MAIN_NAMES = ["3 - RETIRADOS EHA", "PACOTES RETIRADOS"];
const ROMANEIO_NAMES = ["1 - ROMANEIO", "romaneio"];
const PLANO_NAMES = ["4 - FORECAST", "Plano de expedição"];

/** Main records sheet: "PACOTES RETIRADOS" (tolerant to spaces/case); fallback = first non-empty sheet. */
export function retidosMainSheetIndex(sheets: Sheet[]): number {
  const found = findSheet(sheets, MAIN_NAMES);
  if (found) return sheets.indexOf(found);
  return Math.max(0, sheets.findIndex((s) => s.rows.length));
}

/** Returns [headerRowIdx, ...columnIndexes] for the required columns, or null. */
function headerCols(rows: unknown[][], required: string[]): number[] | null {
  const keys = required.map(nameKey);
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = (rows[i] ?? []).map((c) => nameKey(norm(c)));
    const idx = keys.map((k) => r.indexOf(k));
    if (idx.every((x) => x >= 0)) return [i, ...idx];
  }
  return null;
}

const tripleKey = (t: RouteTriple) => `${(t.cluster ?? "").toUpperCase()}|${(t.perfil ?? "").toUpperCase()}|${(t.modelo ?? "").toUpperCase()}`;

export function buildRetidosAux(sheets: Sheet[]): RetidosAux {
  const sheetNames = sheets.map((s) => s.name);
  const missing: string[] = [];
  const warnings: string[] = [];
  const brToAts = new Map<string, Set<string>>();
  const atToRoutes = new Map<string, Map<string, RouteTriple>>();
  let romaneioOk = false, planoOk = false;

  const romaneio = findSheet(sheets, ROMANEIO_NAMES);
  if (!romaneio) missing.push("1 - ROMANEIO (ou romaneio)");
  else {
    const h = headerCols(romaneio.rows, ["SPX TN", "Planned AT"]);
    if (!h) warnings.push(`Aba "${romaneio.name}" encontrada, mas sem as colunas SPX TN e Planned AT.`);
    else {
      romaneioOk = true;
      const [hIdx, brC, atC] = h;
      for (const row of romaneio.rows.slice(hIdx + 1)) {
        const br = normId(row?.[brC]);
        const at = norm(row?.[atC]);
        if (!br || !at) continue;
        if (!brToAts.has(br)) brToAts.set(br, new Set());
        brToAts.get(br)!.add(at);
      }
    }
  }

  const plano = findSheet(sheets, PLANO_NAMES);
  if (!plano) missing.push("4 - FORECAST (ou Plano de expedição)");
  else {
    const h = headerCols(plano.rows, ["AT / TO", "Cluster", "Perfil", "MODELO"]);
    if (!h) warnings.push(`Aba "${plano.name}" encontrada, mas sem as colunas AT / TO, Cluster, Perfil e MODELO.`);
    else {
      planoOk = true;
      const [hIdx, atC, clusterC, perfilC, modeloC] = h;
      for (const row of plano.rows.slice(hIdx + 1)) {
        const at = normId(row?.[atC]);
        if (!at) continue;
        const triple: RouteTriple = {
          cluster: norm(row?.[clusterC]) || null,
          perfil: norm(row?.[perfilC]) || null,
          modelo: norm(row?.[modeloC]) || null,
        };
        if (!atToRoutes.has(at)) atToRoutes.set(at, new Map());
        const routes = atToRoutes.get(at)!;
        const k = tripleKey(triple);
        if (!routes.has(k)) routes.set(k, triple);
      }
    }
  }

  return { sheetNames, romaneioSheet: romaneio?.name ?? null, planoSheet: plano?.name ?? null, missing, warnings, brToAts, atToRoutes, hasAny: romaneioOk && planoOk };
}

/** Resolves one BR to its route. Returns null when the file has no usable auxiliary sheets. */
export function resolveRetidosRoute(aux: RetidosAux, br: unknown): RetidosRouteInfo | null {
  if (!aux.hasAny) return null;
  const empty = { at: null, cluster: null, perfil: null, modelo: null };
  const id = normId(br);
  if (!id) return { match: "nao_identificada", ...empty };
  const ats = aux.brToAts.get(id);
  if (!ats || !ats.size) return { match: "nao_identificada", ...empty };
  if (ats.size > 1) return { match: "ambigua", ...empty };
  const at = [...ats][0];
  const routes = aux.atToRoutes.get(normId(at));
  if (!routes || !routes.size) return { match: "nao_identificada", at, cluster: null, perfil: null, modelo: null };
  if (routes.size > 1) return { match: "ambigua", at, cluster: null, perfil: null, modelo: null };
  const triple = [...routes.values()][0];
  return { match: "ok", at, ...triple };
}
