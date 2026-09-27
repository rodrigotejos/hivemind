# Functional Design Plan - Unit 2: Cockpit Streaming & Auto-Recovery UI

## Objective
Projetar em nível de detalhe lógico e de experiência do usuário os fluxos, regras e componentes para:
- Streaming de deltas e feedback visual em tempo real no Cockpit (Thinking & Typing) (US-1)
- Notificação não-intrusiva de retentativa (Toasts de Auto-Recovery com backoff) (US-2)
- Falha crítica pós-retentativas com bloqueio e interrupt humano (US-3)
- Invariantes de teste baseado em propriedades (PBT) e Resiliency Baseline

## Execution Checklist
- [x] 1. Read the approved answers from the embedded questions in this plan.
- [x] 2. Generate `business-logic-model.md` detalhando a máquina de estados de streaming e auto-recovery.
- [x] 3. Generate `business-rules.md` detalhando políticas de retentativa, transições de status e limites de timeout.
- [x] 4. Generate `domain-entities.md` detalhando payloads de Socket.IO, tipos de eventos e interfaces TypeScript.
- [x] 5. Generate `frontend-components.md` detalhando a hierarquia React, props, estados e estilização do `RecoveryToast` e `TypingStreamBubble`.

---

## Clarification Questions

### Question 1: Estrutura dos Eventos de Recovery via Socket.IO (US-2, US-3)
Como os eventos de auto-recovery devem ser emitidos pelo backend para o frontend?
A) Evento unificado `agent_recovery` com payload contendo `status: 'retrying' | 'recovered' | 'exhausted'`, número da tentativa e mensagem.
B) Três eventos discretos: `agent_recovery_started`, `agent_recovery_success` e `agent_recovery_failed`.
C) Atualizar apenas o status do agente no evento existente `agent_status` adicionando metadata de retry.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 2: Posicionamento e UX do Toast de Auto-Recovery
Onde e como os alertas de retentativa devem ser renderizados no Cockpit?
A) Floating Toast estilizado no canto superior direito (Dark Glassmorphism, com barra de progresso do timer de retry).
B) Banner persistente no topo da área de mensagens da sessão ativa.
C) Mini-badge de aviso dentro do próprio avatar/card do agente no sidebar.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 3: Efeito Visual de Streaming de Texto (US-1)
Durante a recepção dos chunks de streaming do LLM no balão de mensagem:
A) Renderizar com cursor pulsante / blinking cursor (`▋` ou barra animada) ao final do texto e indicador "Digitando...", com fade-in suave na conclusão.
B) Apenas acumular o texto bruto sem cursor ou animações adicionais.
C) Exibir apenas um spinner de "Carregando resposta..." e só mostrar o texto após o término da frase/parágrafo.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 4: Algoritmo de Backoff de Retentativa (Resiliency Baseline)
Qual fórmula de backoff deve ser adotada quando a chamada de IA falhar por rate limit (429) ou timeout?
A) Exponential Backoff com Full Jitter: `delay = Math.random() * (baseDelay * Math.pow(2, attempt))`, com teto máximo de 10s.
B) Exponential Backoff fixo sem jitter: `baseDelay * Math.pow(2, attempt)` (ex: 1s, 2s, 4s).
C) Intervalo linear constante de 3 segundos entre cada tentativa.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

