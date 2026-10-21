/** Analysis-only equivalence; never rewrite imported vehicle names. */
export function retidosVehicleKey(value: string | null): string {
  const normalized = (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return normalized === "FIORINO ADESIVADA" ? "FIORINO" : normalized;
}

/** One count per filtered source occurrence, using only resolved realized models. */
export function countRetidosRealizedVehicles(rows: { extra: unknown }[]) {
  const counts = { MOTO: 0, FIORINO: 0, PASSEIO: 0 };
  let identified = 0;
  for (const row of rows) {
    const extra = row.extra;
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) continue;
    const route = extra as Record<string, unknown>;
    if (route.route_match !== "ok" || typeof route.route_cluster !== "string" || !route.route_cluster.trim() || typeof route.route_modelo !== "string") continue;
    const model = retidosVehicleKey(route.route_modelo);
    if (!model) continue;
    identified++;
    if (model === "MOTO" || model === "FIORINO" || model === "PASSEIO") counts[model]++;
  }
  return { counts, identified };
}

export function retidosVehicleDivergence(pairs: { perfil: string | null; modelo: string | null }[]): "sim" | "nao" | "nao_identificado" {
  if (!pairs.length || pairs.some((pair) => !retidosVehicleKey(pair.perfil) || !retidosVehicleKey(pair.modelo))) return "nao_identificado";
  const planned = new Set(pairs.map((pair) => retidosVehicleKey(pair.perfil)));
  const realized = new Set(pairs.map((pair) => retidosVehicleKey(pair.modelo)));
  if (planned.size !== 1 || realized.size !== 1) return "nao_identificado";
  return [...planned][0] === [...realized][0] ? "nao" : "sim";
}