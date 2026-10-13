// Module registry: each report type feeds ONLY its own module (records.module).
export type FieldKey =
  | "record_date"
  | "order_id"
  | "status"
  | "collaborator"
  | "product"
  | "shift"
  | "route"
  | "lh"
  | "reason"
  | "classification"
  | "month"
  | "location"
  | "quantity";

export type ModuleKey =
  | "full"
  | "avaria"
  | "desvios"
  | "motivos"
  | "auto_add"
  | "on_hold"
  | "lost_damaged"
  | "rotas";

export const FIELD_LABELS: Record<FieldKey, string> = {
  record_date: "Data",
  order_id: "Pedido/BR",
  status: "Status",
  collaborator: "Colaborador",
  product: "Produto",
  shift: "Turno",
  route: "Rota",
  lh: "LH",
  reason: "Motivo",
  classification: "Classificação",
  month: "Mês",
  location: "Localização",
  quantity: "Quantidade",
};

// Header aliases used only to SUGGEST a mapping; the user confirms it.
export const FIELD_ALIASES: Record<FieldKey, string[]> = {
  record_date: ["data", "date", "dia", "data ocorrencia", "data da ocorrencia", "created", "criado em"],
  order_id: ["pedido", "pedido/br", "br", "avaria", "order", "order id", "tracking", "tracking number", "spx tn", "awb", "codigo", "shipment id"],
  status: ["status", "situacao", "estado"],
  collaborator: ["log", "colaborador", "responsavel", "operador", "usuario", "user", "agente", "nome"],
  product: ["produto", "product", "item", "sku", "descricao"],
  shift: ["turno", "shift"],
  route: ["rota", "route", "cluster", "zona"],
  lh: ["lh", "linehaul", "line haul", "lh trip", "trip", "viagem"],
  reason: ["motivo", "reason", "causa", "justificativa", "ocorrencia"],
  classification: ["classificacao", "tipo", "categoria", "classification"],
  month: ["mes"],
  location: ["localizacao", "local", "location"],
  quantity: ["quantidade", "qtd", "qty", "volume", "volumes"],
};

export type ModuleDef = {
  key: ModuleKey;
  slug: string;
  label: string;
  short: string;
  fields: FieldKey[];
  required: FieldKey[];
  dedupe: FieldKey[];
  firstSheetOnly?: boolean;
  defaultMapping?: Record<string, FieldKey>;
  classifications?: string[];
  shifts?: string[];
  description: string;
};

const ALL: FieldKey[] = ["record_date", "order_id", "status", "collaborator", "product", "shift", "route", "lh", "reason", "classification", "quantity"];

export const MODULES: ModuleDef[] = [
  { key: "full", slug: "full", label: "FULL", short: "FULL", fields: ALL, required: [], dedupe: ["order_id", "record_date", "status"], description: "Relatórios FULL do HUB" },
  {
    key: "avaria", slug: "avaria", label: "AVARIA", short: "AVARIA",
    fields: ["record_date", "month", "order_id", "status", "location", "product", "classification", "collaborator", "shift"],
    required: ["order_id"], dedupe: ["order_id", "record_date"], firstSheetOnly: true,
    defaultMapping: { DATA: "record_date", "MÊS": "month", BR: "order_id", AVARIA: "order_id", STATUS: "status", "LOCALIZAÇÃO": "location", PRODUTO: "product", "CLASSIFICAÇÃO": "classification", "EMAIL / OPS": "collaborator", LOG: "collaborator", TURNO: "shift" },
    classifications: ["Líquido", "Vidro", "Sólido", "Item vazio", "SOC"],
    shifts: ["AM1", "AM2", "PM1"],
    description: "Fonte: Dados Diário Avaria HUB-LSP-36 (somente 1ª planilha)",
  },
  { key: "desvios", slug: "desvios", label: "DESVIOS", short: "DESVIOS", fields: ALL, required: [], dedupe: ["order_id", "record_date", "reason"], description: "Desvios operacionais" },
  { key: "motivos", slug: "motivos", label: "MOTIVOS", short: "MOTIVOS", fields: ALL, required: ["reason"], dedupe: ["order_id", "record_date", "reason"], description: "Motivos identificados nos relatórios" },
  { key: "auto_add", slug: "auto-add", label: "AUTO ADD", short: "AUTO ADD", fields: ALL, required: [], dedupe: ["order_id", "record_date", "status"], description: "Relatórios AUTO ADD" },
  { key: "on_hold", slug: "on-hold", label: "ON HOLD", short: "ON HOLD", fields: ALL, required: [], dedupe: ["order_id", "record_date", "status"], description: "Pedidos em ON HOLD" },
  { key: "lost_damaged", slug: "lost-damaged", label: "LOST & DAMAGED", short: "L&D", fields: ALL, required: [], dedupe: ["order_id", "record_date", "status"], description: "Lost & Damaged" },
  { key: "rotas", slug: "rotas", label: "LHs / Rotas", short: "LH/ROTAS", fields: ALL, required: [], dedupe: ["lh", "route", "record_date", "order_id"], description: "LHs e rotas do HUB" },
];

export const moduleByKey = (k: string) => MODULES.find((m) => m.key === k);
export const moduleBySlug = (s: string) => MODULES.find((m) => m.slug === s);

export const HUB_NAME = "HUB LSP-36 — Embu das Artes";

export const normalizeHeader = (h: string) =>
  h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

export function suggestMapping(mod: ModuleDef, headers: string[]): Record<string, FieldKey | ""> {
  const out: Record<string, FieldKey | ""> = {};
  const used = new Set<FieldKey>();
  for (const h of headers) {
    const def = mod.defaultMapping?.[h.trim().toUpperCase()];
    if (def && !used.has(def)) { out[h] = def; used.add(def); continue; }
    out[h] = "";
  }
  for (const h of headers) {
    if (out[h]) continue;
    const n = normalizeHeader(h);
    for (const f of mod.fields) {
      if (used.has(f)) continue;
      if (FIELD_ALIASES[f].includes(n)) { out[h] = f; used.add(f); break; }
    }
  }
  return out;
}
