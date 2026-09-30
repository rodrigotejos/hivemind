# Cockpit Security UI & Status Overhaul - Clarification Questions

Please answer the following questions to help clarify the requirements for this iteration.

## Question 1
Como devemos persistir e exibir o Security Score para evitar o flash/placeholder inicial de "100%" (que é enganoso) e garantir que o valor real do banco seja carregado de imediato?

A) Adicionar colunas `security_score` (INTEGER) e `security_rating` (TEXT) diretamente na tabela `projects` do SQLite + atualizar no momento do scan. Ao carregar `GET /api/projects/:id`, o Cockpit já recebe o score real do banco imediatamente, e caso não haja scan ainda, exibe um skeleton/placeholder neutro (`-- / 100`) em vez de 100%.

B) Criar uma tabela dedicada `security_audits` (com histórico de scans por timestamp) e carregar o último registro consolidado por projeto.

C) Não alterar o schema de `projects`: calcular sob demanda na rota `/api/projects/:projectId/security`, mas no frontend corrigir os fallbacks para nunca exibir `100` como padrão enquanto carrega (exibir skeleton ou `-- / 100`).

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
Com a remoção da caixa de texto ("Ex: Criar tela do Figma, rota backend...") solicitada, como você deseja que o card superior "Coordenação Multi-Agente" seja reformulado?

A) Transformar em um "Centro de Governança & Operações de Segurança": remover a caixa de texto completamente, mantendo os seletores de Modelo e Raciocínio, e focar o botão principal em ações de segurança e governança (ex: "Disparar Auditoria Adversarial", "Verificar Conformidade"), conectando os controles diretamente às rotinas de segurança.

B) Remover a seção "Coordenação Multi-Agente" por completo da tela do Projeto (`ProjectView`), deixando essa tela 100% voltada à Auditoria de Segurança e Figma Studio, centralizando o disparo de novas tarefas exclusivamente no "Terminal do Projeto" (`/projects/:id/messages`).

C) Manter o card compacto apenas como uma barra de status dos agentes ativos (badges, modelo atual e status da execução), sem caixa de texto e sem botões de disparo de tarefas na tela principal.

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
Sobre o status de execução que hoje apenas diz "Executando (agente)..." (marcado com a seta vermelha): como LLMs executam etapas assíncronas e não possuem um cronômetro exato de completion, qual padrão visual você prefere para torná-lo altamente expressivo e focado em segurança?

A) Pipeline Determinístico de 5 Fases + Ticker Ativo:
   Dividir o processo de segurança em 5 fases claras:
   1. Mapeamento de Superfície & Rotas
   2. Varredura de Segredos (.env e chaves)
   3. Simulação Adversarial (Red Team)
   4. Defesas & Mitigações (Blue Team)
   5. Verificação & Gravação no DB
   A UI exibe uma barra de progresso por etapas ("Etapa 3 de 5: Simulação Red Team...") acompanhada de um ticker com a ação exata que está sendo analisada no momento.

B) Live Security Activity Stream (Ticker em Tempo Real):
   Uma linha animada que exibe em tempo real o que o bot está analisando (ex: "Delta Security inspecionando sanitização de parâmetros em /api/projects..."), tempo decorrido ("14s") e arquivos já auditados ("3/8 arquivos").

C) Radar Compacto de Postura de Segurança:
   Exibir badges visuais em tempo real dos pilares de segurança sendo auditados: [CORS: Seguro], [Secrets: Limpo], [Injeções: Em Análise], atualizando dinamicamente conforme os agentes avançam.

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
No card de estatísticas da auditoria que hoje exibe o rótulo fixo "100% Verificadas", qual formato de apresentação você prefere para ser preciso e verdadeiro?

A) "Mitigações Verificadas" com porcentagem matemática real baseada no total (ex: se 1 de 3 mitigadas foi verificada, exibir `33% (1/3)` em vez do texto estático "100%").

B) "Vulnerabilidades Verificadas" apenas com o contador numérico absoluto (ex: `1`), sem a menção a 100%.

C) "Taxa de Resolução" com barra de progresso visual exibindo a proporção de itens mitigados e verificados em relação ao total de achados encontrados.

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
Na aba "Visão Geral & Wiki Técnica", como você prefere a experiência de scroll delimitado e busca simples?

A) Container com altura controlada (`max-h-[550px] overflow-y-auto` com scrollbar escura estilizada) + campo de busca simples no topo com destaque visual (highlight) dos termos pesquisados e contagem de correspondências encontradas.

B) Container com scroll vertical simples (`max-h-[500px]`) + input de busca que filtra e exibe apenas os parágrafos/tópicos que contenham a palavra buscada.

C) Acordeão colapsável por seções (Sumário, Arquitetura, Endpoints, Testes) com scroll interno em cada seção.

D) Other (please describe after [Answer]: tag below)

[Answer]: A
