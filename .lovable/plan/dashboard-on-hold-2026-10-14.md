# Dashboard ON HOLD

## Objetivo
Transformar somente o módulo ON HOLD em uma análise operacional baseada nos registros reais importados, sem alterar outros módulos.

## Implementação
- Configurar ON HOLD para importar exclusivamente a primeira aba e mapear os 11 campos definidos, mantendo ausências como “Nenhum dado disponível”.
- Acrescentar armazenamento próprio para código do produto, tratativa, tentativas, aging, motorista, Driver ID, 3PL e bairro, mantendo cada linha vinculada ao lote e ao módulo ON HOLD.
- Criar o painel ON HOLD com KPIs, motivos, bairros, Top 20 motoristas, tratativas, tentativas, evolução temporal e tabela detalhada pesquisável, ordenável, filtrável e paginada.
- Reutilizar o filtro Dia/Semana/Mês/Personalizado e criar comparação entre dois períodos com variação, análise, resumo, maior crescimento e maior queda quando matematicamente possível.
- Atualizar a prévia da importação para informar a primeira aba utilizada, campos identificados e que as demais abas são ignoradas.

## Regras preservadas
- Somente dados reais; nenhuma estimativa de devoluções ou preenchimento por dedução.
- Dados originais permanecem intactos e isolados pelo módulo ON HOLD.
- As funcionalidades e regras dos demais módulos não serão alteradas.
- Conforme solicitado, não serão executados testes automatizados nem sessões adicionais de validação.
