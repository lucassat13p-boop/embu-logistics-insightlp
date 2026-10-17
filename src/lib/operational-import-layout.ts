import { normalizeHeader } from "./modules";
import { cellText, parseDate } from "./parsers";
import { recordMonth } from "./period";

/** Layout evidence comes from the two source header rows, never total sheet width. */
export function operationalBlockWidth(rows: unknown[][], sheetName: string): 4 | 5 {
  const titles = rows[0] ?? [];
  const headers = rows[1] ?? [];
  const candidates = ([4, 5] as const).map((width) => {
    let titlesMatched = 0, headersMatched = 0, conflicts = 0;
    const expected = width === 5 ? ["record_date", "order_id", "collaborator", "reason", "shift"] : ["order_id", "collaborator", "reason", "shift"];
    const aliases: Record<string, string[]> = {
      record_date: ["data", "date", "dia", "data da ocorrencia", "data do erro"],
      order_id: ["br", "pedido", "pedido/br", "pedido / br"],
      collaborator: ["login", "log", "colaborador", "usuario"],
      reason: ["erro", "motivo", "erro/motivo", "erro / motivo", "tipo de erro"],
      shift: ["turno", "turno original", "shift"],
    };
    ["AM1", "AM2", "PM1"].forEach((shift, block) => {
      const start = block * width;
      const title = cellText(titles[start]);
      if (title) {
        const markers = [...normalizeHeader(title).matchAll(/\b(am\s*[12]|pm\s*1)\b/g)].map((m) => m[0].replace(/\s/g, "").toUpperCase());
        if (markers.includes(shift)) titlesMatched++;
      }
      expected.forEach((field, offset) => {
        const text = normalizeHeader(cellText(headers[start + offset]) ?? "").replace(/\s*\(\d+\)$/, "");
        const actual = Object.entries(aliases).find(([, names]) => names.includes(text))?.[0];
        if (actual === field) headersMatched++;
        else if (actual) conflicts++;
      });
    });
    return { width, safe: titlesMatched >= 2 || (headersMatched >= 3 && conflicts === 0) };
  });
  const safe = candidates.filter((candidate) => candidate.safe);
  if (safe.length !== 1) throw new Error(`Aba "${sheetName}", linhas 1–2, colunas A–O: não foi possível distinguir com segurança os blocos de 4 ou 5 colunas. Confira os títulos AM1/AM2/PM1 e os cabeçalhos.`);
  return safe[0].width;
}

/** Date-only conversion: no local-time conversion and no replacement of missing dates. */
export function parseOperationalDate(value: unknown): { iso: string | null; raw: string | null } {
  const raw = cellText(value);
  if (!raw) return { iso: null, raw: null };
  let iso: string | null = null;
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(raw)) {
    const serial = Math.floor(Number(value));
    if (serial >= 1 && serial <= 2958465 && serial !== 60) {
      const offset = serial < 60 ? 25568 : 25569;
      iso = new Date((serial - offset) * 86400000).toISOString().slice(0, 10);
    }
  } else if (/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})(?:$|[ T])/.test(raw)) {
    iso = parseDate(value).iso;
  }
  return { iso: recordMonth(iso) ? iso : null, raw };
}