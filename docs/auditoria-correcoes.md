# Correções planejadas — Shopee Operations Hub

> Ambiente de trabalho: branch `correcoes`. Não modificar `main`, não executar testes/builds ou publicar o Lovable, não aplicar migrações nem alterar dados Supabase sem aprovação específica.

## Concluído nesta branch

- **Busca global:** paginação estável pelo ID para retornar todos os resultados encontrados no banco (não apenas 1.000); tratamento explícito de erros de consulta. Arquivo: `src/routes/_authenticated/busca.tsx`.
- **Preservado:** pesquisa sem filtro automático de data, seleção de módulo e inclusão da lista ativa de pacotes flutuantes.
- **Validação das importações (parcial):** `src/lib/importer.ts` e `src/lib/full-import.ts` agora interrompem o processo caso a consulta de duplicados falhe, detectam falha ao atualizar o lote e avisam explicitamente quando registros podem ter sido gravados parcialmente. **Ainda não é uma transação atômica e não há rollback automático.**

## Pendente — requer análise de impacto e autorização antes de aplicar

### 1. Regras de acesso (prioridade alta)
- Migrações antigas definem `records` e `operational_treatments` com política UPDATE `USING (true) WITH CHECK (true)` para todo usuário autenticado.
- Definir papéis de usuários e compartilhamento operacional antes de restringir UPDATE ou SELECT. Restringir ao criador indiscriminadamente pode impedir colaboração legítima ou atualizações de relatórios importados por colegas.
- Elaborar migração **nova e reversível**; verificar políticas reais no banco antes de aplicar. Não editar migrações históricas já aplicadas.
- Conferir se o cadastro aberto via `src/routes/auth.tsx` está habilitado no Supabase e se existem regras de convite/aprovação.

### 2. Importação transacional (prioridade alta)
- `src/lib/importer.ts` e `src/lib/full-import.ts` escrevem batches e registros em várias requisições; falhas podem deixar dados parciais.
- Projetar transação server-side/RPC para commits atômicos, mantendo deduplicação por módulo, filtros de SOC/turno e classificações manuais no FULL.
- Planejar mecanismo explícito de recuperação dos lotes já marcados como Erro, sem excluir dados automaticamente.
- Validar em ambiente isolado antes de executar SQL em produção.

### 3. Biblioteca xlsx (prioridade alta)
- `package.json` declara `xlsx ^0.18.5`.
- Pesquisar substituição ou atualização segura com compatibilidade total para XLSX, XLS, CSV e folhas múltiplas.
- Migrar somente com revisão de parsers do FULL, Retidos, On Hold, Avaria e Erros Operacionais; não mudar dependências às cegas.

### 4. Consistência de filtros e indicadores (prioridade média)
- O FULL usa `dateF = ""` (todas as datas) por padrão, enquanto o Dashboard principal começa em Hoje. Considerar preservar a busca histórica e definir período padrão separadamente dos indicadores, com aviso na UI.
- `src/lib/retidos-analysis.ts` atribui turnos por intervalos fixos e deixa horários intermediários sem turno. Confirmar horários oficiais e não inferir turno para registros ambíguos.
- `src/components/ops/FullDashboard.tsx` consolida BR repetido usando o primeiro registro. Definir regra de conflito de status, data e turno antes de alterar a contagem.
- O limite de 50 mil em `src/lib/data.ts` fica para etapa posterior porque o usuário mantém histórico limitado. Se esse teto for alcançado, alertar claramente e/ou adotar agregações paginadas.

## Verificações futuras (não executadas)
- Revisão de código e diffs do branch.
- Testes de regressão e validação funcional, **somente com autorização**.
- Confirmação do comportamento da sincronização GitHub/Lovable antes de eventual merge.
- Backup e plano de reversão de schema/dados antes de migrações.

Nenhuma das etapas pendentes autoriza alteração em `main`, deploy ou execução SQL.
