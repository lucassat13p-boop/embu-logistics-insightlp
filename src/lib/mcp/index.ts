import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listModules from "./tools/list-modules";
import listRecords from "./tools/list-records";
import listImports from "./tools/list-imports";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";
export default defineMcp({
  name: "embu-logistics-insightlp", title: "Embu Logistics Insightlp", version: "0.1.0",
  instructions: "Consulte módulos, ocorrências reais e histórico do HUB LSP-36. Somente leitura, com as permissões do usuário conectado. Nunca invente dados; campos ausentes significam Sem informação e resultados vazios Nenhum dado disponível. Consultas paginadas não representam todo o histórico. Nenhuma ferramenta altera ou exclui dados.",
  auth: auth.oauth.issuer({ issuer: `https://${projectRef}.supabase.co/auth/v1`, acceptedAudiences: "authenticated", requireOAuthClientClaim: true }),
  tools: [listModules, listRecords, listImports],
});