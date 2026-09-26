# Unit of Work Plan

## Methodology and Approach
Este estágio decompõe o escopo das histórias de usuário e componentes projetados em "Unidades de Trabalho" (Units of Work). Como este é um sistema monolítico com frontend (Cockpit) acoplado via Sockets ao backend (Server), podemos dividir o trabalho de forma técnica ou de forma orientada a domínios de negócio/features.

## Execution Checklist

- [x] 1. Read the approved answers from the embedded questions in this plan.
- [x] 2. Generate `unit-of-work.md` definindo as unidades de desenvolvimento.
- [x] 3. Generate `unit-of-work-dependency.md` mostrando a matriz de dependência entre as unidades (ex: UI depende da API de socket primeiro).
- [x] 4. Generate `unit-of-work-story-map.md` mapeando cada História de Usuário (US-1 a US-8) para a sua respectiva unidade de trabalho.
- [x] 5. Validate boundaries and dependencies.

---

## Clarification Questions

Para gerar a quebra correta do sistema em unidades, por favor, responda:

### Question 1: Story Grouping (Estratégia de Agrupamento)
Como você prefere que o trabalho seja dividido em unidades para a fase de construção?

A) **Por Feature End-to-End (Vertical Slicing)**: Cada unidade conterá tanto as mudanças no backend quanto no Cockpit UI. (Ex: Unidade 1 = Streaming inteiro, Unidade 2 = Auto-Recovery inteiro).

B) **Por Componente Técnico (Horizontal Slicing)**: Separar o backend do frontend. (Ex: Unidade 1 = AI Manager e Prompts, Unidade 2 = Socket Gateway e Git, Unidade 3 = Cockpit UI React).

C) **Por Risco/Prioridade**: Unidade 1 = LLM Security & Token, Unidade 2 = Streaming & UI, Unidade 3 = Git & Supervisor.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 2: Dependências e Paralelismo
Como você planeja a execução dessas unidades?

A) **Sequencial e Bloqueante**: A Unidade 2 só começa quando a Unidade 1 estiver 100% testada e integrada. O design minimizará mocks.

B) **Paralelo (Contratos)**: Quero que as unidades sejam independentes para que eu possa trabalhar nelas em paralelo. O design precisará definir os mocks de Socket.IO e LangGraph de forma isolada.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 3: Team Alignment
Como a equipe está estruturada para este projeto?

A) Sou um desenvolvedor Full-Stack (One-man army), farei tudo sequencialmente (Backend e Frontend simultaneamente por feature).

B) Haverá uma separação entre quem mexe no LangGraph (AI Engineer) e quem mexe no React (Frontend Engineer), logo as unidades precisam ser separadas por tecnologia.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

