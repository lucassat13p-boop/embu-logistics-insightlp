// File readers. Run in the browser only (dynamic imports).
export type Sheet = { name: string; rows: unknown[][] };
export type ParsedFile = { format: "xlsx" | "xls" | "csv" | "pdf"; sheets: Sheet[] };

export function detectFormat(name: string): ParsedFile["format"] | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls" || ext === "csv" || ext === "pdf") return ext;
  return null;
}

export async function parseFile(file: File, options?: { preserveBlankRows?: boolean }): Promise<ParsedFile> {
  const format = detectFormat(file.name);
  if (!format) throw new Error("Formato não suportado. Use XLSX, XLS, CSV ou PDF.");
  if (format === "pdf") return { format, sheets: await parsePdf(file) };
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb =
    format === "csv"
      ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true })
      : XLSX.read(buf, { type: "array", cellDates: false });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: options?.preserveBlankRows ?? false, ...(options?.preserveBlankRows ? { range: 0 } : {}) }),
  }));
  return { format, sheets };
}

async function parsePdf(file: File): Promise<Sheet[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const sheets: Sheet[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // group text items into lines by Y coordinate, cells by X gaps
    const lines = new Map<number, { x: number; s: string; w: number }[]>();
    for (const it of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key)!.push({ x: it.transform[4], s: it.str.trim(), w: it.width });
    }
    const rows = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => {
        items.sort((a, b) => a.x - b.x);
        const cells: string[] = [];
        let lastEnd = -Infinity;
        for (const it of items) {
          if (it.x - lastEnd > 8 || cells.length === 0) cells.push(it.s);
          else cells[cells.length - 1] += " " + it.s;
          lastEnd = it.x + it.w;
        }
        return cells;
      });
    sheets.push({ name: `Página ${p}`, rows });
  }
  return sheets;
}

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/** Header row = first row within the top 20 with the most non-empty text cells. */
export function detectHeaderRow(rows: unknown[][]): number {
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i] ?? [];
    const score = r.filter((c) => !isEmpty(c) && typeof c === "string").length;
    if (score > bestScore) { best = i; bestScore = score; }
  }
  return best;
}

export function buildTable(rows: unknown[][], headerIdx: number) {
  const raw = rows[headerIdx] ?? [];
  const seen = new Map<string, number>();
  const headers = raw.map((h, i) => {
    let name = isEmpty(h) ? `Coluna ${i + 1}` : String(h).trim();
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n) name = `${name} (${n + 1})`;
    return name;
  });
  const body: { rowNumber: number; values: Record<string, unknown>; empty: boolean }[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const values: Record<string, unknown> = {};
    headers.forEach((h, j) => (values[h] = r[j] ?? null));
    body.push({ rowNumber: i + 1, values, empty: r.every(isEmpty) });
  }
  return { headers, body };
}

/** Excel serial -> ISO date (1900 system). Also accepts dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy. */
export function parseDate(v: unknown): { iso: string | null; raw: string | null } {
  if (isEmpty(v)) return { iso: null, raw: null };
  const raw = String(v).trim();
  if (typeof v === "number" || /^\d{4,5}(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (n > 20000 && n < 80000) {
      const ms = Math.round((n - 25569) * 86400 * 1000);
      return { iso: new Date(ms).toISOString().slice(0, 10), raw };
    }
  }
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3], raw);
  m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1], raw);
  }
  return { iso: null, raw };
}
function valid(y: number, mo: number, d: number, raw: string) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { iso: null, raw };
  return { iso: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, raw };
}

export function cellText(v: unknown): string | null {
  if (isEmpty(v)) return null;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

export const formatDateBR = (iso: string | null | undefined) =>
  iso ? iso.split("-").reverse().join("/") : "—";
