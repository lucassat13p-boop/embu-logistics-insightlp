import { normalizeHeader } from "./modules";
import { cellText, parseDate } from "./parsers";
import { recordMonth } from "./period";

type OperationalField = "record_date" | "order_id" | "collaborator" | "reason" | "shift";
type OperationalShift = "AM1" | "AM2" | "PM1";
export type OperationalBlock = { shift: OperationalShift; start: number; width: 4 | 5; columns: Partial<Record<OperationalField, number>> };
const shifts: OperationalShift[] = ["AM1", "AM2", "PM1"];
const fieldAliases: Record<OperationalField, string[]> = {
  record_date: ["data", "date", "dia", "data da ocorrencia", "data do erro"],
  order_id: ["br", "pedido", "pedido/br", "pedido / br"],
  collaborator: ["login", "log", "colaborador", "usuario"],
  reason: ["erro", "motivo", "erro/motivo", "erro / motivo", "tipo de erro", "erros", "error", "reason"],
  shift: ["turno", "turno original", "shift"],
};
function headerField(value: unknown): OperationalField | undefined {
  const text = normalizeHeader(cellText(value) ?? "").replace(/\s*\(\d+\)$/, "").replace(/\b(am\s*[12]|pm\s*1)\b/g, "").replace(/[():|]/g, " ").replace(/\s+/g, " ").trim();
  return (Object.keys(fieldAliases) as OperationalField[]).find((field) => fieldAliases[field].includes(text));
}
function titleShifts(value: unknown): OperationalShift[] {
  const text = normalizeHeader(cellText(value) ?? "");
  return [...new Set([...text.matchAll(/\b(am\s*[12]|pm\s*1)\b/g)].map((match) => match[0].replace(/\s/g, "").toUpperCase() as OperationalShift))];
}
export function missingOperationalValue(value: unknown): boolean {
  const text = normalizeHeader(cellText(value) ?? "");
  return !text || /^(#n\s*\/\s*a|n\s*\/\s*a|null|undefined|#value!|#ref!|#div\/0!|#name\?|#num!|#null!|sem informacao|nao informado|nao identificado|-)$/i.test(text);
}
const summaryValue = (value: unknown) => /^(total\b|soma\b|ranking\b|resumo\b|rotulos\b)/.test(normalizeHeader(cellText(value) ?? ""));

/** Locate record headers independently of notices, blank separators and summary titles. */
export function operationalLayout(rows: unknown[][], sheetName: string): { headerIdx: number; blocks: OperationalBlock[] } {
  for (let headerIdx = 0; headerIdx < Math.min(rows.length, 25); headerIdx++) {
    const header = rows[headerIdx] ?? [];
    const blocks: OperationalBlock[] = [];
    for (let br = 0; br < header.length; br++) {
      if (headerField(header[br]) !== "order_id") continue;
      const dated = br > 0 && headerField(header[br - 1]) === "record_date";
      const start = dated ? br - 1 : br;
      const width = dated ? 5 : 4;
      const columns: Partial<Record<OperationalField, number>> = {};
      const found = new Set<OperationalShift>();
      for (let column = start; column < start + width; column++) {
        const field = headerField(header[column]);
        if (field) {
          if (columns[field] !== undefined) continue;
          columns[field] = column;
        }
        titleShifts(header[column]).forEach((shift) => found.add(shift));
      }
      // A BR label alone is not evidence of a record table (pivot tables may use it).
      if (columns.collaborator === undefined || (columns.reason === undefined && columns.shift === undefined)) continue;
      if (!found.size) {
        for (let above = headerIdx - 1; above >= 0; above--) {
          const markers = new Set<OperationalShift>();
          for (let column = start; column < start + width; column++) titleShifts(rows[above]?.[column]).forEach((shift) => markers.add(shift));
          if (!markers.size) continue;
          // General notices naming several shifts are not block titles.
          if (markers.size > 1 && !rows[above]?.some((value) => shifts.includes((cellText(value) ?? "").replace(/\s/g, "").toUpperCase() as OperationalShift))) continue;
          markers.forEach((shift) => found.add(shift));
          break;
        }
      }
      const fail = (detail: string): never => { throw new Error(`Aba "${sheetName}", linha ${headerIdx + 1}, coluna ${br + 1}: ${detail}. Confira os cabeçalhos deste bloco operacional.`); };
      if (found.size !== 1) fail("não foi possível identificar com segurança um único turno responsável");
      if (columns.reason === undefined) {
        const candidate = br + 2;
        const reasonHeader = normalizeHeader(cellText(header[candidate]) ?? "");
        const positional = columns.collaborator === br + 1 && columns.shift === br + 3;
        const incomplete = !reasonHeader || /^(erro|motivo)/.test(reasonHeader);
        const evidence = rows.slice(headerIdx + 1).some((row) => !missingOperationalValue(row[br]) && !summaryValue(row[br]) && !missingOperationalValue(row[candidate]) && !titleShifts(row[candidate]).length);
        if (!positional || !incomplete || !evidence) fail("coluna Erro/Motivo ausente ou ambígua");
        columns.reason = candidate;
      }
      const shift = [...found][0];
      if (!shift) continue;
      if (blocks.some((block) => start < block.start + block.width && start + width > block.start)) fail("campos sobrepostos entre blocos");
      blocks.push({ shift, start, width, columns });
    }
    if (blocks.length) return { headerIdx, blocks };
  }
  // Keep the original title-evidenced contiguous layouts when headers are absent.
  const width = operationalBlockWidth(rows, sheetName);
  return { headerIdx: 1, blocks: shifts.map((shift, index) => {
    const start = index * width;
    const br = start + (width === 5 ? 1 : 0);
    return { shift, start, width, columns: { ...(width === 5 ? { record_date: start } : {}), order_id: br, collaborator: br + 1, reason: br + 2, shift: br + 3 } };
  }) };
}

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