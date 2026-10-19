import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { moduleByKey } from "@/lib/modules";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_imports", title: "Consultar histórico de importações",
  description: "Consulta importações visíveis pelas permissões atuais, sem expor identidades, arquivos ou conteúdo bruto.",
  inputSchema: {
    module: z.string().optional().describe("Módulo opcional retornado por list_modules."),
    limit: z.number().int().min(1).max(100).default(25).describe("Quantidade máxima de importações, entre 1 e 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ module, limit }, ctx) => {
    if (module !== undefined && !moduleByKey(module)) throw new ToolError("Módulo inválido.");
    let query = supabaseForUser(ctx).from("import_batches").select("id,module,status,created_at,total_rows,imported_rows,error_rows").order("created_at", { ascending: false }).limit(limit);
    if (module) query = query.eq("module", module);
    const { data, error } = await query;
    if (error) throw new ToolError("Não foi possível consultar as importações.");
    const rows = (data ?? []).map(r => ({ ...r }));
    return { content: [{ type: "text", text: rows.length ? JSON.stringify(rows) : "Nenhum dado disponível" }], structuredContent: { rows } };
  },
});