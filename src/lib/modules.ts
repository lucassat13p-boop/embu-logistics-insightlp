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
  | "quantity"
  | "tracking_number"
  | "product_code"
  | "treatment"
  | "delivery_attempts"
  | "aging"
  | "driver_name"
  | "driver_id"
  | "carrier_3pl"
  | "neighborhood"
  | "exception_order_id"
  | "follow_up_action"
  | "create_time"
  | "eha_inbound_time"
  | "resolve_time";

export type ModuleKey =
  | "full"
  | "avaria"
  | "desvios"
  | "motivos"
  | "auto_add"
  | "on_hold"
  | "lost_damaged"
  | "rotas"
  | "retidos_veiculos"
  | "erros_operacionais";

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
  tracking_number: "Tracking Number",
  product_code: "Código do Produto",
  treatment: "Tratativa",
  delivery_attempts: "Tentativas de entrega",
  aging: "Aging",
  driver_name: "Motorista",
  driver_id: "Driver ID",
  carrier_3pl: "3PL",
  neighborhood: "Bairro",
  exception_order_id: "Exception Order ID",
  follow_up_action: "Follow Up Action",
  create_time: "Data de Criação",
  eha_inbound_time: "Data de Entrada",
  resolve_time: "Data de Resolução",
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
  tracking_number: ["tracking number", "tracking", "spx tn", "awb"],
  product_code: ["codigo do produto", "código do produto", "codigo produto", "sku"],
  treatment: ["tratativa"],
  delivery_attempts: ["tentativas de entrega", "tentativa de entrega", "tentativas"],
  aging: ["aging"],
  driver_name: ["motorista", "driver", "nome do motorista"],
  driver_id: ["driver id", "id do driver", "id motorista"],
  carrier_3pl: ["3pl", "transportadora"],
  neighborhood: ["bairro"],
  exception_order_id: ["exception order id"],
  follow_up_action: ["follow up action"],
  create_time: ["create time"],
  eha_inbound_time: ["eha inbound time"],
  resolve_time: ["resolve time"],
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
  appendOnly?: boolean;
  fieldLabels?: Partial<Record<FieldKey, string>>;
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
    classifications: ["Líquido", "Sólido", "Vidro", "Item vazio", "SOC"],
    shifts: ["AM1", "AM2", "PM1"],
    description: "Fonte: Dados Diário Avaria HUB-LSP-36 (somente 1ª planilha)",
  },
  { key: "desvios", slug: "desvios", label: "DESVIOS", short: "DESVIOS", fields: ALL, required: [], dedupe: ["order_id", "record_date", "reason"], description: "Desvios operacionais" },
  { key: "motivos", slug: "motivos", label: "MOTIVOS", short: "MOTIVOS", fields: ALL, required: ["reason"], dedupe: ["order_id", "record_date", "reason"], description: "Motivos identificados nos relatórios" },
  {
    key: "retidos_veiculos", slug: "retidos-de-veiculos", label: "RETIDOS DE VEÍCULOS", short: "RETIDOS",
    fields: ["tracking_number", "exception_order_id", "reason", "follow_up_action", "status", "create_time", "eha_inbound_time", "resolve_time"],
    required: [], dedupe: [], firstSheetOnly: true, appendOnly: true,
    defaultMapping: { "SPX TRACKING NUMBER": "tracking_number", "EXCEPTION ORDER ID": "exception_order_id", "EXCEPTION REASON": "reason", "FOLLOW UP ACTION": "follow_up_action", "EO STATUS": "status", "CREATE TIME": "create_time", "EHA INBOUND TIME": "eha_inbound_time", "RESOLVE TIME": "resolve_time" },
    fieldLabels: { tracking_number: "BR / SPX Tracking Number", reason: "Motivo da Retirada", status: "EO Status" },
    description: "Retidos de Veículos (somente 1ª planilha)",
  },
  {
    key: "erros_operacionais", slug: "erros-operacionais", label: "ERROS OPERACIONAIS", short: "ERROS",
    fields: ["reason", "shift", "order_id", "collaborator", "record_date", "classification"],
    required: ["order_id"], dedupe: [],
    fieldLabels: { reason: "Erro/Motivo", order_id: "BR", collaborator: "Login", shift: "Turno responsável" },
    defaultMapping: { "ERRO/MOTIVO": "reason", "TURNO RESPONSÁVEL": "shift", "TURNO RESPONSAVEL": "shift", BR: "order_id", LOGIN: "collaborator", DATA: "record_date", "CLASSIFICAÇÃO": "classification" },
    description: "Fonte: aba TABELAS (XLSX) ou CSV · blocos de 4 colunas ou 5 colunas com Data",
  },
  { key: "auto_add", slug: "auto-add", label: "AUTO ADD", short: "AUTO ADD", fields: ALL, required: [], dedupe: ["order_id", "record_date", "status"], description: "Relatórios AUTO ADD" },
  {
    key: "on_hold", slug: "on-hold", label: "ON HOLD", short: "ON HOLD",
    fields: ["order_id", "tracking_number", "reason", "treatment", "delivery_attempts", "record_date", "aging", "driver_name", "driver_id", "carrier_3pl", "neighborhood", "shift"],
    required: ["order_id"], dedupe: ["order_id", "record_date", "reason"], firstSheetOnly: true,
    defaultMapping: { "TRACKING NUMBER": "tracking_number", "CÓDIGO DO PRODUTO": "order_id", "CODIGO DO PRODUTO": "order_id", "MOTIVO DO ONHOLD": "reason", "MOTIVO DO ON HOLD": "reason", "TRATATIVA (SEPARAR \"FAZER REVERSA\")": "treatment", TRATATIVA: "treatment", "TENTATIVAS DE ENTREGA": "delivery_attempts", "DATA DE SAÍDA COM O DRIVER": "record_date", "DATA DE SAIDA COM O DRIVER": "record_date", AGING: "aging", MOTORISTA: "driver_name", "DRIVER ID": "driver_id", "3PL": "carrier_3pl", BAIRRO: "neighborhood", TURNO: "shift" },
    shifts: ["AM1", "AM2", "PM1"],
    description: "Relatório operacional ON HOLD (somente 1ª planilha)",
  },
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
