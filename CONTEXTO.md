# Piu Mobile — descrição do sistema

Piu Mobile é o painel de design e engenharia da produção. Organiza demandas por produto, modulação e atividade, aponta tempo no chão e mantém os catálogos que alimentam o fluxo.

O lote, o catálogo e a sessão vivem na API Express em `server/`. O frontend Vite fala com ela por `/api`. O banco é SQLite (`server/prisma/dev.db`), fora do git. Login real grava o cookie `gd_session`.

Interface em português (`pt-BR`). Título da janela: "Piu Mobile — Gestão de Demandas & Engenharia".

## Stack

- React 19, componentes de função, arquivos `.jsx`
- Vite 8, plugin `@vitejs/plugin-react`
- Ícones só de `lucide-react`
- Lint `oxlint` (`npm run lint`)
- Sem TypeScript, sem React Router, sem biblioteca de estado
- API: Express, Prisma e SQLite. Planilha no servidor com exceljs
- Estilos globais em `src/index.css` (tokens) e `src/App.css` (layout e componentes)
- Fontes: Plus Jakarta Sans (texto) e JetBrains Mono (códigos, datas, horários e tempo)

Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.

## Arquivos

| Caminho | Papel |
| --- | --- |
| `src/main.jsx` | Monta o React. |
| `src/App.jsx` | Dono do estado e das transições. |
| `src/components/Sidebar.jsx` | Navegação e modo ADM/Executor. |
| `src/components/DashboardView.jsx` | Visão Geral. |
| `src/components/DemandasAdmView.jsx` | Tabela de demandas (ADM e Executor). |
| `src/components/PainelExecutorView.jsx` | Cronômetro e status. |
| `src/components/CronogramaView.jsx` | Lista e Gantt fixo. |
| `src/components/FluxoEtapasView.jsx` | Esteira fixa por produto. |
| `src/components/RelatoriosView.jsx` | Importação, exportação e backups. |
| `src/components/CadastrosView.jsx` | Catálogos e diagrama. |
| `src/components/NewDemandModal.jsx` | Criação de demandas e filhas. |
| `src/insights.js` | Avisos locais, sem rede. |
| `src/planilha.js` | Leitura de `.xlsx` e download CSV. |
| `src/backups.js` | Grava e lê backups no navegador. |
| `src/data/mockData.js` | 17 demandas iniciais, status, motivos e fallback antigo de cores. |
| `src/data/cadastrosData.js` | Catálogo inicial: atividades, subprocessos, pessoas, produtos e modulações. |

## Shell

`App` monta sidebar, topbar, a tela ativa, o modal de nova demanda, o painel Insight e um toast. A aba inicial é `demandas`. O toast fica 3,5 s e some em 160 ms. Não há timer de limpeza no desmonte: o React em modo estrito apagaria o aviso antes da hora.

Abaixo de 900 px a sidebar vira gaveta. O botão da topbar abre e fecha (`menuAberto`). Um fundo escuro fecha a gaveta. Trocar de aba também fecha. Em 900 px ou mais a sidebar fica fixa e o botão do menu some. Alvos de toque dessa faixa (menu, filtros, chips, Nova Demanda, abas de Cadastros, botões do cronômetro, ações de relatório e backup) têm no mínimo 44 px. O desktop não usa essa altura.

Ordem da sidebar:

| id | Rótulo | Quem vê |
| --- | --- | --- |
| `dashboard` | Visão Geral | ADM e Executor |
| `demandas` | Demandas | ADM e Executor. O selo mostra a quantidade do lote. |
| `executor` | Painel Executor | ADM e Executor |
| `cronograma` | Cronograma | ADM e Executor |
| `relatorios` | Exportação de Relatórios | só ADM |
| `fluxo` | Fluxo de Etapas | ADM e Executor |
| `cadastros` | Cadastros | só ADM |

Login obrigatório. O nome do rodapé é o usuário da sessão.

Dois modos de tela:

- `ADM`: todas as abas. Só papel ADMIN troca o modo. A lista de demandas é o lote inteiro.
- `EXECUTOR`: Cadastros e Exportação de Relatórios somem e a aba ativa passa a ser o Painel Executor. `GET /api/demandas` devolve só o que essa pessoa executa. Visão Geral, Cronograma, Fluxo, Demandas e Painel usam essa lista. TI e GERENCIA seguem a ligação do tipo, não o executor da planilha.

O atalho `Ctrl+K` (ou `Cmd+K`) abre Demandas e foca `.search-input`. O botão de busca rápida faz o mesmo. O sino abre o Insight.

Clicar uma demanda (tabela, cronograma, fluxo, alerta ou aviso do Insight) chama `handleSelectDemand`: define a demanda ativa, vai para o Painel Executor e mostra toast. Cartão do cronograma, barra do Gantt, etapa do fluxo e alerta também abrem com Enter ou Espaço.

Controles respondem ao clique com um encolhimento curto e ao teclado com anel ciano (`:focus-visible`). `prefers-reduced-motion` tira deslocamento e loop; o fade curto permanece. O cronômetro em andamento pulsa. Barras da Visão Geral crescem ao entrar na tela. Nada disso, sozinho, grava demanda nem catálogo.

## Visual

Tema escuro. `color-scheme: dark` no `:root` e nos controles nativos, para o select do Windows não abrir branco.

Tokens em `src/index.css`:

- Fundo `--bg-main` `#0a0c10`, superfície `--bg-surface` `#141722`, sidebar `--bg-sidebar` `#0e1117`
- Texto `--text-primary`, `--text-secondary`, `--text-muted`
- Acentos `--accent-cyan`, `--accent-blue`, `--accent-amber`, `--accent-emerald`, `--accent-purple`, `--accent-rose`
- Raio `--radius-sm` 6 px até `--radius-lg` 14 px
- Movimento `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`; durações 150 ms, 160 ms, 280 ms e 160 ms

Classes reutilizadas: `page-container`, `page-header`, `page-title`, `page-subtitle`, `btn-primary`, `btn-secondary`, `card`, `data-table`, `form-input`, `form-select`, `form-label`, `status-pill`, `priority-pill`, `activity-dot`. Botão que não envia formulário leva `type="button"`. Erro de formulário usa `role="alert"` e recebe foco.

A cor de cada atividade na interface vem de `catalog.atividades[].cor`. `ATIVIDADES_CONFIG` em `mockData.js` é fallback antigo.

## Demanda

Objeto em `demands`. A semente tem 17 registros em `INITIAL_DEMANDS`.

| Campo | Significado |
| --- | --- |
| `id` | Código `DEM-` mais quatro dígitos. Nova demanda sorteia entre 1000 e 9999, sem repetir id já usado. |
| `atividade` | Nome do tipo, em maiúsculas. |
| `produto` | Nome do produto, em maiúsculas. |
| `modulacao` | Variante do produto (ex.: `POL`, `1B 1A`, `TODAS`). |
| `especificacao` | Texto da tarefa. Obrigatório na criação e na importação. |
| `executor` | Nome do colaborador responsável. |
| `prioridade` | `Alta`, `Média` ou `Baixa`. |
| `solicitacao` | Data `dd/mm/aaaa`. |
| `status` | Um dos status abaixo. |
| `tempoEstimado` | Texto, ex. `45 min`. O cronômetro e o Insight leem o primeiro número como minutos. |
| `tempoEmAtividadeSegundos` | Tempo apontado, em segundos. |
| `motivoPausa` | Motivo atual, ou `null`. |
| `historicoParadas` | Lista `{ motivo, horario }` com horário `HH:mm`. |
| `observacoes` | Texto livre. Demandas antigas podem não ter o campo. |
| `aguardaId` | Id da demanda anterior, ou `null`. A filha fica `Aguardando` até essa demanda ir para `Concluída`. |
| `subprocessos` | Ids dos subprocessos marcados na criação. Lista vazia quando a atividade não usa. |

Status em `STATUS_LIST`:

- Aguardando aprovação
- Aguardando
- Liberada
- Em andamento
- Pausado
- Concluída
- Rejeitada

Transições que o Painel Executor grava:

- Iniciar ou retomar: status `Em andamento`, limpa o motivo de pausa.
- Pausar: status `Pausado`, grava motivo e acrescenta o histórico. Motivo padrão se nenhum estiver escolhido: `Setup / preparação`. Escolher um motivo com o cronômetro rodando também pausa.
- Finalizar: status `Concluída`. Se alguma demanda tem `aguardaId` igual a esse id e ainda está `Aguardando`, ela passa a `Liberada`. O toast avisa quantas etapas foram liberadas.
- Zerar: grava `tempoEmAtividadeSegundos` como 0. O status não muda.

Motivos de parada: Setup / preparação, Manutenção / ferramenta, Falta de material / arquivo, Aguardando informação, Reunião, Outro.

Demanda nova entra no topo da lista, com tempo zero, sem pausa e sem histórico. O status inicial padrão é `Liberada`. O formulário também aceita `Aguardando` e `Aguardando aprovação`. Filha nasce sempre `Aguardando`.

## Catálogo

Estado `catalog`, semente `INITIAL_CATALOG`.

- **Atividades** (`atividades`): `id`, `nome`, `ordem`, `minutos`, `colaboradorPadrao`, `usaSubprocessos`, `cor`, `proximas` (ids das etapas seguintes). A ordem agrupa colunas no diagrama.
- **Subprocessos** (`subprocessos`): mapa por id da atividade. Cada linha tem `id`, `codigo` (letra A–Z), `nome`, `minutos`, `ordem`. Só a atividade com `usaSubprocessos` libera inclusão. Hoje só LISTAGEM usa subprocessos: listas de madeira, espuma, embalagem, laminação, metalúrgica, almofada, percinta e custos (códigos A–L).
- **Colaboradores**: `id`, `nome`, `login`, `senha`, `papel`, `atividades` (ids), `telas` (ids). Papéis: Executor, Planejador, Admin. Pessoas da semente: GUSTAVO (Admin), MATHEUS, EZIO, MAYCON, RAYANE (Planejador), ANDERSON, TATIANE. Telas possíveis: dashboard, demandas, executor, fluxo, cronograma, cadastros, relatorios. A lista `telas` do colaborador não filtra a sidebar. A senha fica no objeto e não entra em sessão.
- **Produtos** e **modulações**: `{ id, nome }`.
- **Diagrama padrão** (`diagramDefault`): cópia de `id`, `ordem` e `proximas` para restaurar o fluxo.

Nomes de catálogo são gravados em maiúsculas (`pt-BR`). Login em minúsculas. Nome e login de colaborador, e nome de produto, modulação e atividade, não podem repetir.

Renomear propaga para as demandas. `handleCatalogChange(next, rename)` recebe `{ field, from, to }` e troca o valor em `demands` e na demanda ativa. Campos: `atividade`, `produto`, `modulacao`, `executor`. Renomear colaborador também atualiza `colaboradorPadrao` das atividades.

Não é possível excluir atividade, produto, modulação ou colaborador que ainda apareça numa demanda. A mensagem pede para renomear. Excluir atividade também remove subprocessos dela, tira o id das ligações `proximas` e das atividades visíveis dos colaboradores.

O diagrama liga etapas com dois cliques: o primeiro escolhe a origem, o segundo liga ou desliga `proximas`. Dá para salvar o desenho atual como padrão e restaurar o padrão salvo. O desenho não cria nem apaga demandas.

Cadastros só renderiza com `appMode === 'ADM'`.

Fluxo inicial das atividades (ordem e próximas):

1. Entradas soltas, ordem 0: BLOCO 3D, SOLICITAÇÃO COMERCIAL, DOCUMENTAÇÃO PARA TERCEIROS, TI, GERÊNCIA. Comercial e documentação apontam para 3D estrutural. TI e gerência não têm próxima.
2. Ordem 1: 3D ESTRUTURAL aponta para RECORTES, LISTAGEM e MODELAGEM.
3. Ordem 2: RECORTES aponta para LISTAGEM. LISTAGEM aponta para CADASTRO. MODELAGEM aponta para ENCAIXE.
4. Ordem 3: ENCAIXE e CADASTRO apontam para CONFERÊNCIA.
5. Ordem 4: CONFERÊNCIA aponta para TABELA.
6. Ordem 5: TABELA aponta para FICHA TÉCNICA.
7. Ordem 6: FICHA TÉCNICA encerra.

## Telas

### Visão Geral (`DashboardView`)

Os números saem de `GET /api/dashboard`. No modo executor a rota usa o mesmo corte da lista. Se a API falhar, a tela conta o lote já carregado.

- Demandas em Andamento: quantidade `Em andamento`. O subtítulo conta as `Liberada`.
- Eficiência Geral: concluídas dividido pelo total, arredondada. Sem demandas, 0.
- Concluídas no lote: total `Concluída`. Não há data de conclusão, então não é "concluídas hoje".
- Gargalos & Paradas: quantidade `Pausado`.

Barras contam demandas por atividade, usam a cor do catálogo e ordenam da maior contagem para a menor. Ranking é concluídas dividido pelo total de cada executor. Alertas listam até quatro demandas pausadas ou em andamento e abrem o executor. O botão Nova Demanda abre o modal.

### Demandas (`DemandasAdmView`)

Mesmo layout nos dois modos: busca, atividade, executor, Limpar, Buscar e pills de status. O cabeçalho ordena e a borda da coluna redimensiona. Estado vazio: "Nenhuma demanda encontrada para esta busca."

No ADM a linha tem Executar e Excluir, e o botão "Tornar editável (planilha)" grava em lote. No Executor a lista já veio filtrada; não há planilha nem exclusão. Clicar a linha abre o Painel.

### Painel do Executor (`PainelExecutorView`)

`GET /api/painel` monta a fila com `ordenarFilaPainel`: só Liberada, Em andamento e Pausado, agrupadas por produto, produto em foco primeiro. O select usa esses grupos. Fixar produto grava `produtoFocoFixadoId`. Abaixo, a cadeia do produto em foco separada por modulação. Cronômetro `HH:MM:SS`, pausa, finalizar e zerar continuam na demanda ativa.

### Cronograma (`CronogramaView`)

Dia, Semana e Mês filtram pela data de solicitação. As barras do Gantt 08:00–17:00 usam o tempo estimado dessas demandas. Sem demanda na data, a grade mostra as liberadas, em andamento e pausadas do lote visível. Cartão e barra abrem a demanda.

### Fluxo de Etapas (`FluxoEtapasView`)

Filtro por produto, com `aria-pressed`. A esteira lista as demandas daquele produto, na ordem de `diagramDefault`. Trocar o produto troca as etapas. Clicar um passo abre a demanda. Quem libera a próxima etapa continua sendo a conclusão no servidor, não o desenho da esteira.

### Cadastros (`CadastrosView`)

Abas: Subprocessos, Colaboradores, Produtos, Modulações, Tipo de atividade, Diagrama de atividades. As cinco primeiras mostram a quantidade de itens. A faixa não quebra linha; no celular ela rola na horizontal. Seta esquerda, seta direita, Home e End trocam a aba. Só a aba ativa entra na ordem do Tab.

Incluir um registro é um bloco separado da lista, com borda ciano à esquerda. Subprocessos, produtos e modulações mostram esse bloco o tempo todo. O botão nomeia o que entra: "Adicionar subprocesso", "Adicionar produto", "Adicionar modulação", "Adicionar colaborador", "Adicionar tipo". Colaboradores e tipo de atividade escondem o formulário até "Novo colaborador", "Novo tipo" ou Editar. Cancelar fecha sem gravar. "Ver diagrama" fica no cabeçalho da lista de tipos, fora do botão de incluir.

Novo tipo mostra só nome, ordem, minutos, cor, colaborador padrão e "Usa subprocessos". As etapas anterior e próxima ficam num botão "Ligações", fechado, com o resumo "Antes" e "Depois". Abrir esse botão revela as duas listas, uma ao lado da outra. Editar um tipo que já existe abre as ligações. Novo tipo começa com elas fechadas. Marcar uma etapa grava `proximas` e as anteriores do mesmo jeito.

Formulários validam vazio e duplicata. O erro vai para um aviso com `role="alert"`, recebe foco e liga ao campo por `aria-describedby`. A borda do campo inválido fica vermelha. Digitar no campo limpa o erro. Exclusão pede confirmar e cancelar na própria linha: a linha ganha fundo vermelho e o texto "Excluir?". Cancelar desfaz o pedido. Confirmar ainda bloqueia item que `isCatalogNameUsed` encontra e pede para renomear.

### Exportação de Relatórios (`RelatoriosView`)

Só ADM. A tela tem três blocos, não quatro cartões iguais: a prévia da planilha, a lista de destinos e a lista de backups.

Importar lê a aba Desenvolvimento de um `.xlsx` no browser, sem biblioteca. O leitor aceita ZIP armazenado ou deflate. Entram só TI, GERÊNCIA e DOCUMENTAÇÃO PARA TERCEIROS, e só com especificação preenchida. Outras atividades são ignoradas. A importação não apaga demandas existentes e não cria ligação no fluxograma (`aguardaId` não é preenchido).

O cabeçalho precisa das colunas Atividade e Especificação. Aliases aceitos, sem acento: atividade/tipo; produto; modulação/módulo; especificação/descrição/detalhe/observação; executor/responsável/colaborador; prioridade; solicitação/data; tempo estimado/tempo/minutos. Sem tempo, valem os minutos do tipo no catálogo. Sem executor, vale a pessoa logada. Prioridade fora de Alta, Média e Baixa vira Média. Data numérica do Excel vira `dd/mm/aaaa`. A leitura para nas 2.000 primeiras linhas com conteúdo. Demanda importada nasce `Liberada`, tempo apontado 0, id `DEM-` e 4 dígitos.

Pré-visualizar mostra o que entra. Importar agora só fica ativo com linhas na prévia. Erro da planilha usa `role="alert"` e recebe foco.

Destinos:

- Baixar planilha: CSV com BOM, separado por ponto e vírgula, arquivo `demandas.csv`.
- Abrir lista: aba Demandas.
- Abrir eficiência: Visão Geral.
- Abrir cronograma: aba Cronograma.

Baixar cronoanálise gera `cronoanalise.csv` a partir do lote vivo: tempo apontado, o primeiro número de `tempoEstimado`, a diferença e os motivos de `historicoParadas`. A tela não mostra essas tabelas.

Backups ficam abaixo. Salvar backup grava uma cópia do lote e do catálogo. A lista mostra data, quantidade de demandas e de tipos. Restaurar pede "Restaurar?" na linha e troca o lote e o catálogo abertos. A demanda ativa continua se o id ainda existir; senão fica a primeira do lote restaurado. Excluir pede "Excluir?" e tira só o backup. Se o navegador recusar a gravação, o aviso pede para excluir um backup antigo. Recarregar a página zera o lote em uso e mantém os backups.

### Nova demanda (`NewDemandModal`)

Abre pela Visão Geral e pela tabela de Demandas. Escape e o fundo escuro fecham. O foco inicial vai para a especificação.

Campos: especificação, atividade (o rótulo mostra os minutos do tipo), produto em texto livre, uma ou mais modulações do catálogo, subprocessos quando o tipo usa, próximas etapas do diagrama, executor desta demanda, prioridade (padrão Média), status inicial, tempo estimado em minutos, data de solicitação e observações.

Especificação, produto e ao menos uma modulação são obrigatórios. Produto e especificação são gravados em maiúsculas. O tempo da demanda principal segue a soma dos subprocessos marcados e pode ser editado. Se nenhum subprocesso estiver marcado, o tempo volta aos minutos do tipo. Marcar uma próxima etapa revela só as etapas seguintes daquela, com o colaborador padrão do tipo. Desmarcar apaga o ramo.

Cada modulação gera uma demanda com os mesmos dados. Cada etapa marcada gera uma filha por modulação, status `Aguardando`, `aguardaId` da etapa anterior, executor escolhido na etapa e tempo igual aos minutos daquele tipo. O botão conta o total, pais e filhas. A esteira visual do Fluxo não muda.

## Estado e contratos

`App` é a única dona de `demands`, `catalog`, `backups`, `currentTab`, `appMode`, `activeDemand`, `isModalOpen`, `menuAberto`, `insightAberto` e `toastMessage`.

As views recebem dados e callbacks. Não gravam catálogo nem demanda por fora de:

- `handleAddDemand` — aceita uma demanda ou uma lista e coloca no topo
- `handleUpdateDemandStatus` — status, tempo, pausa e liberação da filha
- `handleSelectDemand`
- `handleCatalogChange`
- `handleImportDemands`
- `handleSalvarBackup`
- `handleRestaurarBackup`
- `handleExcluirBackup`
- `isCatalogNameUsed(field, value)` — olha se alguma demanda ainda usa aquele nome

## Insight

`src/insights.js` lê `demands` no browser. Não chama modelo nem API. O sino abre o painel e mostra a quantidade de avisos. Clique num aviso chama `handleSelectDemand`. Um toast aparece quando surge um aviso que ainda não foi mostrado nesta sessão. O mesmo aviso não repete a cada render. Se o aviso some e volta, o toast dispara de novo.

Ordem, da mais urgente para a mais branda. Dentro do mesmo nível, ordena pelo id da demanda:

1. Prioridade `Alta` e status `Liberada` ou `Aguardando`. Id `alta-parada:{id}`.
2. Prioridade `Alta` e status `Pausado`. Id `alta-pausa:{id}`.
3. Tempo apontado maior que `tempoEstimado`, fora de `Concluída`, e o estimado maior que zero. Id `atraso:{id}`.
4. Três ou mais demandas `Pausado` na mesma atividade. O clique abre a primeira pausada dessa atividade. Id `gargalo:{atividade}`.

## O que ainda fica de fora

- A lista `telas` do colaborador não filtra a sidebar. O corte é o modo ADM ou Executor.
- O Insight continua local, em cima do lote já carregado.

Ao evoluir o produto, preserve os nomes, os status, os motivos de pausa, a propagação de renomeação e o bloqueio de exclusão de item ainda usado.
