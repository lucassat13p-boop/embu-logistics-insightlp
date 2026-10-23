import type { RecordRow } from "./data";

const missingLogin = /^(#n\/a|n\/a|null|undefined|sem informação|nenhum dado disponível|não identificado)$/i;

/** Ranking-only copies: preserve every source record and identified login spelling. */
export function errorLoginRankingRows(rows: RecordRow[], includeMissing: boolean): RecordRow[] {
  return rows.flatMap((row) => {
    const login = row.collaborator?.trim();
    if (login && !missingLogin.test(login)) return [row];
    return includeMissing ? [{ ...row, collaborator: "Não identificado" }] : [];
  });
}