# Requirements Clarification Questions

Realizei uma validação minuciosa no código fonte (focando em `ai-manager.ts`, `nodes.ts` e arquitetura geral) utilizando o `codebase-memory`. Baseado na sua solicitação, elaborei o plano primário de melhorias e novas features, ordenado do mais fácil/útil para o mais complexo/menos útil.

Por favor, responda às questões abaixo para definirmos o escopo exato que será implementado na próxima fase.

## Proposta do Plano Primário

### PARTE 1: Melhorias, Performance e Segurança (Ordem: Fácil/Melhor → Complexo)

1. **[Fácil / Alto Impacto] Prompts Performance (Desacoplamento)**: Extrair prompts hardcoded (ex: em `ai-manager.ts` e `nodes.ts`) para um registro ou arquivos separados, melhorando a manutenção e permitindo hot-reload.
2. **[Fácil / Alto Impacto] LLM Security (Structured Output)**: Substituir o parse manual via regex (`replace(/```json/g, '')`) no `analyzeMessagePriority` pelo uso oficial de Structured Output (JSON Schema) da API do Gemini, prevenindo injeções de prompt e falhas de formatação.
3. **[Médio / Bom Impacto] Performance de Código e Token Accounting**: O método `summarizeProject` apenas corta as mensagens (`slice(-20)`). O plano é implementar sumarização com sliding window inteligente utilizando a contagem exata de tokens já disponível no `telemetry-service.ts`.
4. **[Complexo / Menor Impacto] Process Performance (Timeouts e Streams)**: Melhorar a resiliência do `bridge-daemon` removendo timeouts estáticos e implementando processamento assíncrono avançado para não travar a UI (Cockpit).

### PARTE 2: Novas Features (Ordem: Rápido/Bom → Demorado/Menos útil)

1. **[Rápido / Excelente] Real-time Streaming no Cockpit**: Fazer os agentes enviarem texto em "streaming" (typing effect) para o Socket.IO invés de aguardar toda a resposta do LLM, melhorando drasticamente a UX.
2. **[Médio / Bom] Agente de Auto-Recovery**: Criar um mecanismo para que, se a API da LLM falhar (rate limit/timeout), um fallback não retorne string estática (`[AgentName]: Execução concluída...`), mas ative uma fila de re-tentativa e notifique o usuário na UI.
3. **[Demorado / Menos Útil] Git Diff & Auto-Commit Supervisor**: Permitir que o supervisor proponha commits reais no repositório no final de cada rodada do LangGraph, invés de apenas atualizar o "Shared Context" no banco de dados.

---

## Question 1
Sobre a **PARTE 1 (Melhorias, Performance e Segurança)**, quais itens devemos incluir no escopo deste ciclo de desenvolvimento?

A) Incluir todos os itens propostos (1 a 4).

B) Incluir apenas os de Fácil/Médio impacto (1, 2 e 3).

C) Incluir apenas os críticos de LLM Security e Prompts (1 e 2).

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2
Sobre a **PARTE 2 (Novas Features)**, quais funcionalidades devemos implementar neste ciclo?

A) Incluir todas as features propostas (1 a 3).

B) Incluir apenas o Streaming no Cockpit e o Auto-Recovery (1 e 2).

C) Incluir apenas o Streaming no Cockpit (1).

D) Não incluir features novas agora, focar apenas nas melhorias.

X) Other (please describe after [Answer]: tag below)

[Answer]: 
