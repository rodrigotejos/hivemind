# Story Generation Plan

## Methodology and Approach
As melhorias propostas misturam infraestrutura pesada de agentes (LLM, tokens, backend) com mudanças diretas de UX no front-end (streaming). Sugere-se uma abordagem **Feature-Based** combinada com **User Journey** para focar em como o principal usuário da plataforma (Supervisor Humano) vai sentir essas mudanças no dia a dia.

## Execution Checklist

- [x] 1. Read the approved answers from the embedded questions in this plan.
- [x] 2. Generate `personas.md` with user archetypes (ex: Human Supervisor, System Administrator).
- [x] 3. Generate `stories.md` with user stories organized by the Feature-Based approach (Streaming, Auto-Recovery, LLM Security/Prompts, Git Auto-Commit).
- [x] 4. Ensure all stories follow the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable).
- [x] 5. Write specific BDD-style (Given/When/Then) Acceptance Criteria for each story (especialmente cruciais para cenários de Retry/Timeout e Structured Output).
- [x] 6. Map the personas to the relevant user stories in the documentation.

---

## Clarification Questions

Para gerar as histórias com a granularidade e foco corretos, por favor, responda:

### Question 1: Story Granularity para Backend/Infra
Como as melhorias de backend (LLM Security, extração de prompts e contagem de tokens) não têm uma "interface de usuário" direta, como você prefere que essas histórias sejam escritas?

A) Focar no valor entregue ao "System Administrator" (ex: "Como administrador, quero que as respostas sejam em JSON puro para evitar crash no pipeline").

B) Usar a abordagem de "Histórias Técnicas / Enablers" sem focar muito em uma persona humana.

C) Agrupar todas as melhorias internas numa única história Épica de "Resiliência de Backend".

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 2: Comportamento do Real-time Streaming
Para a interface de Cockpit, qual o nível de detalhe esperado nas histórias sobre o Real-time Streaming?

A) Detalhar até os estados de "Agente Pensando", "Digitando..." e transições visuais de término da mensagem.

B) Manter abstrato ("A mensagem aparece progressivamente na tela").

C) Focar primariamente nos eventos do Socket.IO sendo recebidos e renderizados (foco mais técnico).

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 3: Fluxo do Auto-Recovery
Para a feature de Auto-Recovery de falhas da API da LLM, como o usuário deve ser notificado?

A) Mostrar um toast/alerta não-intrusivo ("Agente X sofreu timeout, retentando 1/3...").

B) Bloquear a UI do chat com um skeleton de loading para aquele agente até a tentativa ser sucedida ou falhar de vez.

C) Não notificar na UI as retentativas intermediárias, apenas se falhar permanentemente (onde exibirá a mensagem de erro).

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 4: Git Auto-Commit Approval
No processo de Git Auto-Commit ao final da rodada do LangGraph, o supervisor precisará confirmar antes do push?

A) Sim, apresentar um Modal/Diff interativo no Cockpit onde o Supervisor aprova o commit gerado pelos agentes.

B) Não, os agentes fazem commit e push automaticamente; o humano apenas vê no histórico.

C) Os agentes apenas geram as mudanças locais (no disco), o commit e push continuam sendo manuais feitos pelo dev no seu terminal.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

