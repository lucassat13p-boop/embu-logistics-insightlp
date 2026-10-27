# Correções planejadas — Shopee Operations Hub

> Ambiente de trabalho: branch `correcoes`. Não modificar `main`, não executar testes/builds ou publicar o Lovable, não aplicar migrações nem alterar dados Supabase sem aprovação específica.

## Concluído nesta branch

- **Busca global:** paginação estável pelo ID para retornar todos os resultados encontrados no banco (não apenas 1.000); tratamento explícito de erros de consulta. Arquivo: `src/routes/_authenticated/busca.tsx`.
- **Preservado:** pesquisa sem filtro automático de data, seleção de módulo e inclusão da lista ativa de pacotes flutuantes.
- **FULL:** status bruto desconhecido em importações antigas permanece pendente mesmo sem sinalização antiga; classificações manuais inválidas equivalentes a LMHub_Received não são exibidas como resolvidas.
- **Filtros de módulos genéricos:** indicadores e tabela usam o mesmo período selecionado (incluindo Auto Add); não há mais filtro “Hoje” oculto adicional na tabela. Falhas de leitura mostram aviso e opção de tentar novamente.
- **Validação das importações (parcial):** `src/lib/importer.ts` e `src/lib/full-import.ts` agora interrompem o processo caso a consulta de duplicados falhe, detectam falha ao atualizar o lote e avisam explicitamente quando registros podem ter sido gravados parcialmente. **Ainda não é uma transação atômica e não há rollback automático.**

- **Datas importadas:** `src/lib/parsers.ts` rejeita datas impossíveis, como 31/04 e 29/02 em anos não bissextos, antes de transformar o valor em data do sistema.
- **Pesquisa ampliada:** busca geral passa a incluir Tracking Number, TO Number, motorista, driver ID, transportadora, status FULL, código de produto e outros campos operacionais que antes não eram pesquisados.

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

## Notas de segurança e rollout (27/10/2026)

- **Cadastro aberto:** a tela `src/routes/auth.tsx` fornece `signUp`. Se o Supabase permitir cadastro livre, a política RLS de SELECT para qualquer `authenticated` pode expor informações a contas recém-criadas. Restringir a capacidade de registrar/acessar por convites e/ou tabela de usuários aprovados é prioridade alta, mas o sistema já pode ter usuários ativos; não fechar acesso sem inventário e verificação da configuração real do provedor.
- **RLS:** não corrigir apenas mudando `USING (true)` para `created_by = auth.uid()`; isso pode quebrar classificações de FULL, importações atualizadas por outra pessoa e tratativas compartilhadas. Construir esquema de aprovação/papéis e depois uma migração aditiva com políticas para edição e leitura, com auditoria de UPDATE em função atômica invoker.
- **Excel:** a dependência `xlsx@0.18.5` está travada em `bun.lock` e deve ser substituída ou atualizada junto com o lockfile via instalação reproduzível. A distribuição oficial corrigida do SheetJS usa tarball fora do registro npm; não alterar só `package.json` sem atualizar `bun.lock`. A nova versão precisa preservar XLS, XLSX, CSV, datas e múltiplas abas. Mudança não aplicada nesta etapa porque o artefato oficial não pôde ser obtido/verificado neste ambiente.
- **Importações:** `commitImport` e `commitFullImport` ainda executam vários UPSERTs de 500 em chamadas independentes. Exibir avisos não torna a operação atômica. A correção completa exige RPC transacional, tratamento de dedupe, checagem de ownership em atualizações, referências de lotes, idempotência e implementação correspondente no frontend, depois validação isolada e migração em produção.
- **Não foram realizados** testes, builds, conexão com dados de produção ou aplicação de SQL. Recomenda-se revisão manual e verificação em ambiente isolado antes de merge.

## Etapa adicional: transparência do histórico (27/10/2026)

- `src/lib/data.ts`: histórico de lotes e de avisos passa a usar paginação com ordenação estável; removidos tetos anteriores de 1.000 lotes e 5.000 avisos por consulta. A consulta de registros mantém teto de 50.000 em módulos usuais conforme decisão anterior.
- `src/components/ops/BatchList.tsx`: em lote com status Erro a coluna importados mostra 'Não confirmado' em vez de 0, porque a gravação de chunks pode ter persistido dados parciais. Falha na leitura do histórico passa a ser mostrada.
- `src/routes/_authenticated/historico.$id.tsx`: detalhes informam explicitamente risco de gravação parcial em lotes com Erro, não apresentam zero como contagem confirmada, e mostram falhas de carregamento de lotes/avisos.
- As mudanças são somente de interface/consulta; **não fornecem atomicidade nem verificam contagens persistidas de lotes falhos**. Não realizar testes/deploy/migrações sem autorização.
