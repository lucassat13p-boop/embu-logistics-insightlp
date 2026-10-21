/** Analysis-only equivalence; never rewrite imported vehicle names. */
export function retidosVehicleKey(value: string | null): string {
  const normalized = (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return normalized === "FIORINO ADESIVADA" ? "FIORINO" : normalized;
}

export function retidosVehicleDivergence(pairs: { perfil: string | null; modelo: string | null }[]): "sim" | "nao" | "nao_identificado" {
  if (!pairs.length || pairs.some((pair) => !retidosVehicleKey(pair.perfil) || !retidosVehicleKey(pair.modelo))) return "nao_identificado";
  const planned = new Set(pairs.map((pair) => retidosVehicleKey(pair.perfil)));
  const realized = new Set(pairs.map((pair) => retidosVehicleKey(pair.modelo)));
  if (planned.size !== 1 || realized.size !== 1) return "nao_identificado";
  return [...planned][0] === [...realized][0] ? "nao" : "sim";
}