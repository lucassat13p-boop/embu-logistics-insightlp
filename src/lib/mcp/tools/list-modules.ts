import { defineTool } from "@lovable.dev/mcp-js";
import { MODULES } from "@/lib/modules";

export default defineTool({
  name: "list_modules", title: "Listar módulos",
  description: "Lista os módulos operacionais e seus identificadores para consultas de relatórios.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({ content: [{ type: "text", text: MODULES.map(m => `${m.key}: ${m.label}`).join("\n") }] }),
});