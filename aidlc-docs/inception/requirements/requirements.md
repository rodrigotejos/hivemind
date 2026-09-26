# Requirements Analysis Document

## Intent Analysis Summary
- **User Request**: Realizar validação minuciosa do código usando MCP codebase-memory e criar um plano primário de melhorias e novas features estruturadas por complexidade/impacto.
- **Request Type**: Enhancement, Refactoring, New Features
- **Scope Estimate**: System-wide (Afeta `server`, arquitetura LangGraph, `ai-manager`, UI Cockpit)
- **Complexity Estimate**: Complex

## Contexto e Escopo
A validação do código atual detectou oportunidades de melhoria na segurança, performance de LLM e experiência do usuário no Cockpit. Com base nas respostas do usuário (A para ambas as perguntas do plano primário), o escopo para esta iteração de desenvolvimento abrange *todas* as melhorias propostas e *todas* as novas features.

---

## Functional Requirements

### FR1: Prompts Performance (Desacoplamento)
- Extrair todos os prompts hardcoded dos arquivos TypeScript (especialmente em `ai-manager.ts` e `nodes.ts`).
- Migrar os prompts para um sistema de registro ou arquivos separados (Markdown/JSON) que permita fácil manutenção e hot-reload sem necessidade de recompilar o código base.

### FR2: Real-time Streaming no Cockpit
- Modificar o fluxo de execução dos nós do LangGraph e do AI Manager para suportar "streaming" de texto.
- Implementar eventos via Socket.IO que transmitam a resposta em "typing effect" para a interface de UI (Cockpit), substituindo o modelo atual que aguarda o retorno completo do LLM antes de exibir a mensagem.

### FR3: Agente de Auto-Recovery
- Implementar lógica de fallback resiliente no `ai-manager.ts` e nos workers do LangGraph.
- Se a API do Google Gemini retornar erro de rate limit (429) ou timeout, o sistema deve enfileirar a chamada para re-tentativa (retry pattern com backoff) ao invés de devolver uma string de fallback estática.
- Notificar o usuário via Cockpit sobre o status de recovery.

### FR4: Git Diff & Auto-Commit Supervisor
- Expandir a capability do supervisor ou adicionar um novo sub-agente com a função de gerar um Git diff real.
- Ao término de uma rodada, caso alterações no `Shared Context` envolvam também intenções de refatoração aprovadas, o sistema deverá propor a criação de commits locais ou atualização do código fonte real através de ferramentas CLI locais/MCP.

---

## Non-Functional Requirements

### NFR1: Security (LLM Structured Output)
- **Segurança e Confiabilidade**: O parse manual de respostas JSON usando regex no método `analyzeMessagePriority` deve ser substituído pela feature de *Structured Output* (JSON Schema) da API Gemini.
- Isso previne injeções de prompt ("Prompt Injection") e quebra de pipeline decorrente de JSONs mal formados.

### NFR2: Performance (Token Accounting & Sumarização)
- **Eficiência**: Substituir a estratégia atual do `summarizeProject` que utiliza apenas `.slice(-20)` nas mensagens.
- Implementar uma lógica de "sliding window" baseada em `token accounting` (já disponível no `telemetry-service.ts`) para maximizar o contexto enviado ao LLM sem extrapolar o limite da janela de contexto de forma aleatória, otimizando o gasto e a precisão do resumo.

### NFR3: Process Performance (Resiliência do Daemon)
- **Disponibilidade**: Eliminar os limites de timeouts estáticos globais (ex: 300000ms) presentes no `bridge-daemon`.
- Adotar processamento 100% assíncrono avançado que mantenha a saúde da Thread principal, suportando execuções extensas de agentes Red/Blue Team sem causar desconexões ou falsos timeouts na UI.

---

## Key Requirements Summary
Este projeto foca em evoluir a maturidade da aplicação AI-DLC Hivemind Coordinator. O sistema ganhará maior resiliência no tratamento de erros com LLM, mitigação rigorosa de injeção de prompt usando Structured Outputs, e performance inteligente de tokens. Na interface e no controle, o usuário desfrutará de respostas em tempo real via Server-Streaming e o supervisor terá a habilidade de realizar Commits no código ao final da convergência.
