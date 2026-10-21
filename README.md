# Embu Logistics Insightlp

Crie um sistema web completo chamado:



SHOPEE OPERATIONS HUB



O sistema será utilizado para controle, análise e acompanhamento de operações logísticas do HUB LSP-36 — Embu das Artes.



IMPORTANTE:

Este sistema deve ser construído para trabalhar com DADOS REAIS.

NÃO utilizar dados mockados, fictícios, números inventados, exemplos preenchidos ou informações estimadas.



Se ainda não existir um relatório real importado para determinado módulo, o sistema deve mostrar:

"Nenhum dado disponível"



ou deixar o indicador sem valor.



Nunca criar números fictícios apenas para preencher gráficos, cards, rankings ou tabelas.



==================================================

1. OBJETIVO DO SISTEMA

==================================================



Criar uma plataforma central de operações capaz de:



- receber relatórios reais;

- importar arquivos;

- interpretar automaticamente os dados;

- identificar colunas;

- permitir mapeamento das colunas;

- validar os registros;

- salvar os dados em banco;

- atualizar automaticamente os dashboards;

- manter histórico das importações;

- permitir filtros;

- gerar rankings;

- gerar gráficos;

- cruzar informações somente quando houver dados reais compatíveis;

- identificar problemas e inconsistências;

- centralizar os principais indicadores da operação.



O sistema deve ser preparado para crescer posteriormente com integrações, Google Sheets e recursos de IA.



==================================================

2. REGRA ABSOLUTA SOBRE DADOS

==================================================



REGRA PRINCIPAL:



NUNCA INVENTAR DADOS.



Não criar:

- números fictícios;

- pedidos fictícios;

- colaboradores fictícios;

- turnos fictícios;

- valores estimados;

- rankings fictícios;

- gráficos com dados inventados;

- indicadores simulados;

- informações preenchidas automaticamente sem origem real.



Todos os dados exibidos devem possuir origem em um relatório realmente importado ou em uma base real cadastrada.



Se determinado campo não existir no relatório:

- não inventar;

- não deduzir;

- não calcular sem base;

- não preencher com informação fictícia.



Mostrar:

"Sem informação no relatório"



ou



"Nenhum dado disponível".



==================================================

3. LOCAL DA OPERAÇÃO

==================================================



O sistema deve ser configurado para:



HUB LSP-36 — Embu das Artes



Não criar seletor de outros hubs neste momento.



Toda a operação apresentada no sistema deve estar relacionada ao HUB LSP-36.



==================================================

4. IDENTIDADE VISUAL

==================================================



Criar interface profissional inspirada visualmente no ambiente corporativo/logístico da Shopee.



Utilizar:

- laranja;

- branco;

- cinza;

- preto;

- cartões modernos;

- tabelas profissionais;

- gráficos limpos;

- sidebar;

- cabeçalho;

- ícones;

- boa hierarquia visual.



Não copiar literalmente interfaces proprietárias.



O sistema deve parecer uma plataforma profissional interna de operações.



Desktop-first, mas responsivo para tablet e celular.



==================================================

5. ESTRUTURA PRINCIPAL

==================================================



Criar sidebar com:



- Dashboard

- Pedidos

- LHs / Rotas

- Pendências

- Relatórios

- Importar Dados

- Configurações



No topo ou na navegação principal criar acesso aos módulos:



- FULL

- AVARIA

- DESVIOS

- MOTIVOS

- AUTO ADD

- ON HOLD

- LOST & DAMAGED



==================================================

6. DASHBOARD PRINCIPAL

==================================================



O Dashboard principal deve ser uma página única consolidando:



FULL

AUTO ADD

ON HOLD



Não criar três dashboards gerais separados.



Mostrar em uma única visão:



- indicadores principais;

- evolução temporal;

- status;

- distribuição por turno;

- distribuição por rota/LH;

- pendências;

- rankings;

- últimos registros;

- alertas;

- informações relevantes da operação.



Porém:



OS VALORES SÓ DEVEM APARECER SE EXISTIREM DADOS REAIS IMPORTADOS.



Exemplo:



Se não existir relatório FULL importado:



FULL

Nenhum dado disponível



Não preencher com números fictícios.



==================================================

7. MÓDULO FULL

==================================================



Criar módulo próprio para FULL.



Deve permitir importar relatório real de FULL.



O sistema deve identificar automaticamente as colunas disponíveis.



Permitir:

- filtros;

- busca;

- ordenação;

- paginação;

- indicadores;

- gráficos;

- tabelas;

- status;

- evolução;

- análise por turno;

- análise por rota/LH;

- análise por colaborador quando essa informação existir.



Tudo baseado exclusivamente no relatório real.



==================================================

8. MÓDULO AUTO ADD

==================================================



Criar módulo próprio para AUTO ADD.



Permitir importar relatório real.



Criar:

- indicadores;

- gráficos;

- tabelas;

- evolução;

- filtros;

- ranking;

- análise por turno;

- análise por colaborador;

- análise por rota/LH;



somente quando essas informações existirem no relatório.



Não inventar campos que não estejam disponíveis.



==================================================

9. MÓDULO ON HOLD

==================================================



Criar módulo próprio para ON HOLD.



Permitir importar relatório real.



Mostrar somente informações existentes na base.



Criar:

- quantidade;

- status;

- evolução;

- pedidos;

- pendências;

- responsáveis;

- turnos;

- rotas;



somente se essas informações existirem no relatório.



==================================================

10. MÓDULO AVARIA

==================================================



Criar módulo completo de AVARIA.



Fonte inicial real:



"Cópia de Dados Diário Avaria HUB-LSP-36 Embu das Artes.xlsx"



Para esta fonte, utilizar SOMENTE A PRIMEIRA PLANILHA.



A primeira planilha possui os campos:



DATA

AVARIA

STATUS

LOG

PRODUTO



Mapear:



DATA = data da ocorrência



AVARIA = Pedido/BR



STATUS = status



LOG = colaborador/responsável



PRODUTO = produto



Não utilizar outras abas desse arquivo para complementar os dados.



Não buscar informações de outras planilhas do arquivo para preencher campos ausentes.



==================================================

11. AVARIA — CLASSIFICAÇÕES

==================================================



As classificações oficiais de Avaria são somente:



- Líquido

- Vidro

- Sólido

- Item vazio

- SOC



Porém, o relatório inicial informado não possui uma coluna de classificação.



Portanto:



NÃO tentar descobrir a classificação através de outras informações.



NÃO inferir classificação pelo nome do produto.



NÃO inventar classificação.



Se não existir no relatório:



"Classificação: Sem informação"



==================================================

12. AVARIA — TURNOS

==================================================



Os turnos oficiais são:



- AM1

- AM2

- PM1



Porém, se o relatório importado não possuir o campo de turno:



NÃO deduzir o turno.



NÃO criar turno baseado em horário.



NÃO inventar.



O bloco:



"Turnos mais ofensores"



deve apresentar:



"Nenhum dado disponível"



até existir uma fonte real contendo turno.



==================================================

13. AVARIA — DASHBOARD

==================================================



Criar:



KPI:

- Total de Avarias

- Líquido

- Vidro

- Sólido

- Item vazio

- SOC



Os KPIs de classificação somente devem apresentar valores quando houver informação real.



Criar gráficos:



- Avarias por classificação

- Avarias por turno

- Evolução das avarias



Somente exibir dados quando existirem campos reais correspondentes.



Criar ranking:



"Colaboradores com mais avarias"



Baseado no campo LOG.



Criar ranking:



"Turnos mais ofensores"



Baseado no campo de turno real, quando disponível.



==================================================

14. AVARIA — TABELA

==================================================



Criar tabela:



"Ocorrências dos pedidos"



Campos:



- Data

- Pedido/BR

- Produto

- Classificação

- Colaborador

- Turno

- Status



Adicionar:

- busca;

- filtros;

- ordenação;

- paginação;

- visualização detalhada.



Não criar o bloco:



"Ocorrências por origem"



Esse bloco NÃO deve existir.



A origem é fixa:



HUB LSP-36 — Embu das Artes.



==================================================

15. MÓDULO DESVIOS

==================================================



Criar módulo próprio para DESVIOS.



Permitir importação de relatório real.



Criar:

- indicadores;

- tabelas;

- gráficos;

- evolução;

- rankings;

- filtros;



somente com dados realmente existentes.



==================================================

16. MÓDULO MOTIVOS

==================================================



Criar módulo próprio para MOTIVOS.



Permitir importação de relatório real.



O sistema deve identificar os motivos existentes no arquivo.



Não criar motivos fictícios.



Permitir:

- ranking;

- distribuição;

- evolução;

- filtros;

- tabela detalhada.



==================================================

17. MÓDULO LOST & DAMAGED

==================================================



Criar módulo próprio para LOST & DAMAGED.



Permitir importação de relatório real.



Criar:

- indicadores;

- evolução;

- tabela;

- filtros;

- status;

- rankings;



somente com dados reais.



==================================================

18. LHs / ROTAS

==================================================



Criar módulo para LHs / Rotas.



Permitir importação de relatório real.



Mostrar:

- LH;

- rota;

- status;

- data;

- turno;

- responsável;

- demais campos;



somente quando existirem no relatório.



==================================================

19. IMPORTADOR UNIVERSAL

==================================================



CRIAR UM IMPORTADOR REAL E FUNCIONAL PARA TODO O SISTEMA.



Não criar importação apenas para Avaria.



O importador deve funcionar para:



- FULL

- AVARIA

- DESVIOS

- MOTIVOS

- AUTO ADD

- ON HOLD

- LOST & DAMAGED

- LHs / Rotas



Formatos:



- XLSX

- XLS

- CSV

- PDF



Fluxo:



1. Selecionar arquivo

2. Fazer upload

3. Identificar formato

4. Ler arquivo

5. Identificar planilhas/páginas

6. Identificar cabeçalhos

7. Identificar colunas

8. Permitir mapeamento

9. Mostrar prévia

10. Validar

11. Mostrar erros

12. Confirmar importação

13. Salvar no banco

14. Atualizar automaticamente o módulo

15. Registrar histórico da importação



NÃO exigir copiar e colar os dados.



==================================================

20. LEITURA DE EXCEL

==================================================



Para XLSX/XLS:



- detectar planilhas;

- permitir escolher a planilha quando necessário;

- detectar cabeçalhos;

- reconhecer nomes de colunas;

- converter datas corretamente;

- tratar números;

- preservar texto;

- identificar linhas vazias;

- ignorar linhas completamente vazias;

- validar campos obrigatórios.



Para Avaria, utilizar somente a primeira planilha da fonte especificada.



==================================================

21. DATAS DO EXCEL

==================================================



O sistema deve reconhecer datas do Excel.



Exemplo:



45470



não deve ser exibido simplesmente como 45470.



Converter corretamente para a data correspondente.



Também aceitar formatos como:



09/05/2024

2024-05-09

09-05-2024



sem perder a informação original.



==================================================

22. MAPEAMENTO DE COLUNAS

==================================================



O sistema não pode depender somente da posição das colunas.



Deve reconhecer cabeçalhos.



Exemplo:



"AVARIA"

"Pedido"

"Pedido/BR"

"BR"



podem representar o campo de pedido quando o usuário confirmar o mapeamento.



Criar interface:



COLUNA DO ARQUIVO → CAMPO DO SISTEMA



Permitir salvar o mapeamento para reutilizar em futuras importações semelhantes.



==================================================

23. VALIDAÇÃO

==================================================



Antes de salvar:



mostrar resumo:



Registros encontrados:

X



Registros válidos:

X



Registros com erro:

X



Registros ignorados:

X



Não mostrar centenas de erros ocupando a tela.



Mostrar somente os primeiros erros como exemplo e permitir expandir para visualizar todos.



Exemplo:



"201 registros encontrados"

"0 válidos"

"201 com problemas"



Mostrar claramente qual coluna está causando o problema.



==================================================

24. BOTÃO CONFIRMAR IMPORTAÇÃO

==================================================



O botão:



"Confirmar importação"



deve funcionar realmente.



Ao clicar:



- validar novamente;

- salvar os registros válidos;

- criar histórico;

- relacionar ao módulo correto;

- atualizar dashboard;

- mostrar confirmação.



Não criar botão visual sem ação.



==================================================

25. ISOLAMENTO DOS MÓDULOS

==================================================



Cada relatório deve alimentar somente o módulo correspondente.



Exemplo:



AVARIA → AvariaRecord



FULL → FullRecord



DESVIOS → DesvioRecord



MOTIVOS → MotivoRecord



AUTO ADD → AutoAddRecord



LOST & DAMAGED → LostDamagedRecord



ON HOLD → OnHoldRecord



LH/ROTAS → Route/LH Record



Não permitir que um relatório seja automaticamente utilizado em outro módulo.



Cruzamentos entre módulos somente poderão acontecer quando houver regra definida e dados reais compatíveis.



==================================================

26. BANCO DE DADOS

==================================================



Criar estrutura de banco adequada.



Entidades sugeridas:



AvariaRecord

FullRecord

DesvioRecord

MotivoRecord

AutoAddRecord

OnHoldRecord

LostDamagedRecord

RouteRecord

ImportBatch

ImportError

Collaborator



Cada registro deve possuir informações de origem da importação quando aplicável.



Criar relacionamento com ImportBatch.



==================================================

27. HISTÓRICO DE IMPORTAÇÕES

==================================================



Criar página:



"Histórico de Importações"



Mostrar:



- nome do arquivo;

- módulo;

- data/hora;

- usuário;

- quantidade de registros;

- válidos;

- erros;

- status;

- duração;

- detalhes.



Status:



- Processando

- Concluído

- Concluído com avisos

- Erro



Permitir visualizar detalhes da importação.



==================================================

28. RELATÓRIOS

==================================================



Criar área de relatórios com:



- relatórios importados;

- período;

- módulo;

- status;

- quantidade;

- erros;

- histórico.



Permitir pesquisar e filtrar.



==================================================

29. PENDÊNCIAS

==================================================



Criar área para pendências identificadas nos dados reais.



Exemplos:



- registros incompletos;

- campos obrigatórios ausentes;

- pedidos duplicados;

- estrutura diferente;

- erros de mapeamento;

- inconsistências.



Não criar pendências fictícias.



==================================================

30. BUSCA GLOBAL

==================================================



Criar busca global para localizar dados reais.



Permitir pesquisar quando aplicável por:



- Pedido/BR;

- colaborador;

- produto;

- LH;

- rota;

- status;

- motivo.



A busca deve retornar somente dados existentes no banco.



==================================================

31. FILTROS

==================================================



Todos os módulos devem possuir filtros compatíveis com seus dados.



Exemplos:



- período;

- data;

- turno;

- status;

- colaborador;

- pedido;

- produto;

- rota;

- LH;

- motivo;

- classificação.



Não mostrar filtros de campos que não possuem dados naquele módulo.



==================================================

32. GRÁFICOS

==================================================



Gráficos devem ser gerados dinamicamente a partir dos dados reais.



Se não houver dados suficientes:



mostrar:



"Nenhum dado disponível para este gráfico."



Nunca criar gráfico com números fictícios.



==================================================

33. RANKINGS

==================================================



Rankings devem ser calculados exclusivamente com dados reais.



Exemplos:



- colaboradores com mais ocorrências;

- turnos com mais ocorrências;

- motivos mais frequentes;

- rotas com mais ocorrências;

- produtos mais envolvidos.



Somente criar ranking quando houver os respectivos campos reais.



==================================================

34. DUPLICIDADE

==================================================



Criar mecanismo para detectar possíveis registros duplicados.



Ao importar o mesmo relatório novamente, o sistema não deve simplesmente duplicar todos os registros.



Mostrar opção de:



- ignorar duplicados;

- atualizar;

- importar somente novos registros;



conforme a estrutura dos dados.



Nunca apagar dados anteriores automaticamente.



==================================================

35. SEGURANÇA

==================================================



Criar estrutura preparada para autenticação e permissões.



Usuários devem possuir níveis de acesso posteriormente.



Registrar quem realizou cada importação.



==================================================

36. CONFIGURAÇÕES

==================================================



Criar área de configurações para:



- mapeamentos de colunas;

- tipos de relatório;

- campos obrigatórios;

- regras de validação;

- histórico;

- permissões.



Não permitir alterações que façam o sistema inventar dados.



==================================================

37. RESPONSIVIDADE

==================================================



Interface responsiva.



Desktop como prioridade.



No celular:

- sidebar adaptada;

- tabelas com rolagem;

- cards reorganizados;

- filtros adaptados.



==================================================

38. EXPERIÊNCIA DO USUÁRIO

==================================================



Interface simples e profissional.



Usar:



- cards;

- tabelas;

- badges;

- filtros;

- modais;

- menus;

- tooltips;

- mensagens de sucesso;

- mensagens de erro;

- estados de carregamento;

- estados vazios.



Exemplo de estado vazio:



"Nenhum dado disponível"



"Importe um relatório para visualizar os indicadores."



==================================================

39. IMPORTANTE SOBRE O ESTADO INICIAL

==================================================



O sistema pode possuir toda a estrutura visual desde o primeiro acesso.



PORÉM:



NÃO preencher o sistema com dados fictícios.



Exemplo:



Card:



TOTAL DE AVARIAS

Nenhum dado disponível



Gráfico:



AVARIAS POR MOTIVO

Nenhum dado disponível



Tabela:



Nenhum registro encontrado.



Isso é obrigatório.



==================================================

40. ARQUITETURA PARA CRESCIMENTO

==================================================



Estruturar o sistema para posteriormente receber:



- Google Sheets;

- APIs;

- integrações;

- automações;

- IA;

- alertas;

- análises preditivas;

- notificações;

- permissões avançadas.



Porém não criar dados fictícios para simular essas funcionalidades.



==================================================

41. IA FUTURA

==================================================



Preparar arquitetura para um futuro assistente de IA capaz de responder perguntas como:



"Qual turno teve mais avarias?"



"Quais colaboradores tiveram mais ocorrências?"



"Quais pedidos estão pendentes?"



"Qual motivo aparece com maior frequência?"



"Quais rotas apresentam mais ocorrências?"



Mas a IA deverá responder somente utilizando os dados reais existentes no banco.



Se não houver dados suficientes:



"Não existem dados suficientes para responder."



==================================================

42. REGRA FINAL

==================================================



O sistema deve ser REAL DATA FIRST.



Fluxo obrigatório:



RELATÓRIO REAL

↓

UPLOAD

↓

LEITURA

↓

IDENTIFICAÇÃO

↓

MAPEAMENTO

↓

VALIDAÇÃO

↓

BANCO DE DADOS

↓

MÓDULO CORRETO

↓

DASHBOARD

↓

ANÁLISES



NUNCA:



MOCK

↓

NÚMERO INVENTADO

↓

DASHBOARD



Não criar dados de demonstração.



Não criar colaboradores fictícios.



Não criar pedidos fictícios.



Não criar números fictícios.



Não preencher campos ausentes.



Não inferir informações que não estejam comprovadas no relatório.



Se não houver informação real, mostrar claramente:



"Nenhum dado disponível."



==============

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://embu-logistics-insightlp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c082cd64-30ba-4114-b69a-d0f2cb11b79e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
