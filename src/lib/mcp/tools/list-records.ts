import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { moduleByKey } from "@/lib/modules";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_records", title: "Consultar ocorrências",
  description: "Consulta uma página de ocorrências reais de um módulo, com datas opcionais; não inclui nomes de pessoas nem conteúdo bruto.",
  inputSchema: {
    module: z.string().describe("Identificador retornado por list_modules."),
    start_date: z.iso.date().optional().describe("Data inicial inclusiva YYYY-MM-DD; omitida não restringe o início."),
    end_date: z.iso.date().optional().describe("Data final inclusiva YYYY-MM-DD; omitida não restringe o fim."),
    order_id: z.string().min(1).max(200).optional().describe("Pedido/BR exato, opcional."),
    limit: z.number().int().min(1).max(100).default(25).describe("Quantidade máxima da página, entre 1 e 100."),
    offset: z.number().int().min(0).max(50000).default(0).describe("Quantidade de registros a pular."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ module, start_date, end_date, order_id, limit, offset }, ctx) => {
    if (!moduleByKey(module)) throw new ToolError("Módulo inválido; consulte list_modules.");
    if (start_date && end_date && start_date > end_date) throw new ToolError("Período inválido.");
    const client = supabaseForUser(ctx);
    let query = client.from("records").select("id,module,record_date,order_id,tracking_number,status,classification,shift,product,route,lh,quantity", { count: "exact" }).eq("module", module).order("record_date", { ascending: false, nullsFirst: false }).order("id").range(offset, offset + limit - 1);
    if (start_date) query = query.gte("record_date", start_date);
    if (end_date) query = query.lte("record_date", end_date);
    if (order_id) query = query.eq("order_id", order_id);
    const { data, count, error } = await query;
    if (error) throw new ToolError("Não foi possível consultar as ocorrências.");
    const rows = (data ?? []).map(r => ({ ...r }));
    return { content: [{ type: "text", text: rows.length ? JSON.stringify({ total: count, offset, rows }) : "Nenhum dado disponível" }], structuredContent: { total: count ?? 0, offset, rows } };
  },
});