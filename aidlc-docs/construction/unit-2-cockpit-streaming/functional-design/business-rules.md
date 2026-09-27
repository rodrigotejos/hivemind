# Business Rules - Unit 2: Cockpit Streaming & Auto-Recovery UI

## 1. Regras de Streaming & Typing (US-1)

### BR-STR-01: Estado Inicial e Transição de Tokens
- Quando um nó de agente do LangGraph é despachado, o backend deve emitir imediatamente `agent_step_started` com status `'thinking'`.
- A UI do Cockpit deve exibir o badge "Thinking..." acompanhado de animação de pulso.
- No primeiro chunk emitido pelo LLM via `streamChat`, a UI transiciona para o estado "Typing..." e inicia a renderização cumulativa do texto.

### BR-STR-02: Cursor de Digitação e Conclusão
- Enquanto a mensagem estiver no status `'streaming'` ou `'typing'`, um cursor piscante animado (`▋` ou span CSS) deve ser fixado ao final do texto visível.
- Quando o evento de encerramento (`agent_step_finished` ou `new_message`) for recebido:
  1. O cursor piscante é removido.
  2. O balão de mensagem transiciona suavemente com fade-in e borda de concluído.
  3. A mensagem oficial persistida no SQLite assume o controle de renderização.

---

## 2. Regras de Auto-Recovery e Backoff Adaptativo (US-2, US-3)

### BR-REC-01: Classificação Inteligente de Erros e Delays Base
- O algoritmo de retry analisa o erro retornado pela chamada da LLM/API:
  - **Cenário A (Header/Mensagem com Retry-After)**: Se o erro contiver a indicação explícita de segundos para aguardar (ex: `retry after 15s`), o sistema utiliza exatamente esse valor como delay.
  - **Cenário B (429 / Quota / Resource Exhausted)**: Se o erro indicar rate limit ou estouro de cota por minuto (RPM/TPM), adota delay base de **10.000ms (10 segundos)**.
  - **Cenário C (503 / Network / Overloaded)**: Se for uma instabilidade transitória de rede ou servidor sobrecarregado, adota delay base rápido de **2.000ms (2 segundos)**.

### BR-REC-02: Fórmula de Backoff com Jitter
- Para as tentativas $k \in \{1, 2, 3, 4, 5\}$:
  $$\text{delay}_k = \min\left(60000, \text{baseDelay} \times 2^{k-1}\right) \times (1 \pm \text{jitter})$$
  onde o $\text{jitter} \in [-0.15, +0.15]$ (variação de até ±15% para evitar colisões simultâneas de agentes).
- Teto absoluto: 60 segundos por tentativa.

### BR-REC-03: Limite Máximo e Falha Crítica (US-3)
- O limite máximo de retentativas é fixado em **5 tentativas**.
- Se a 5ª tentativa falhar:
  1. O backend emite `agent_recovery` com `status: 'exhausted'`.
  2. A execução do grafo é pausada (`status: 'waiting_human'`).
  3. Um `InterruptPayload` é registrado no estado do projeto.
  4. O Cockpit bloqueia o fluxo daquela tarefa e exibe o modal de decisão para o operador humano (tentar novamente, alterar modelo de IA ou cancelar tarefa).

### BR-REC-04: Notificação Não-Intrusiva no Cockpit
- O Cockpit deve exibir um **Floating Toast** posicionado no canto superior direito:
  - Estilo: Dark Glassmorphism (`bg-zinc-950/90`, `border-amber-500/30`, `backdrop-blur-md`).
  - Conteúdo: Ícone de alerta, nome do agente, número da tentativa (`Tentativa 2 de 5`), motivo resumido e barra de progresso regressiva do timer.
  - Se a tentativa for bem-sucedida, o toast atualiza para `status: 'recovered'` com ícone esmeralda de sucesso e é descartado automaticamente após 3 segundos.
  - O chat principal **não** deve ser congelado durante o período de espera.

---

## 3. Propriedades Invariantes para Property-Based Testing (PBT)

| ID | Propriedade Invariante | Descrição |
| :--- | :--- | :--- |
| **PBT-U2-01** | *Backoff Monotonicity & Ceiling* | Para qualquer sequência de tentativas de 1 a 5, o delay nominal (sem jitter) é estritamente não-decrescente e nunca ultrapassa 60.000ms. |
| **PBT-U2-02** | *Jitter Boundedness* | Para qualquer tentativa e baseDelay, o delay final com jitter sempre permanece dentro de $[0.85 \times \text{delayNominal}, 1.15 \times \text{delayNominal}]$. |
| **PBT-U2-03** | *Streaming Text Concatenation* | Para qualquer sequência de chunks parciais recebidos, a concatenação cumulativa preserva exatamente o texto final sem omissões ou trocas de ordem. |
| **PBT-U2-04** | *Max Retry Bound* | O sistema nunca executa mais de 5 tentativas de retry para a mesma operação antes de declarar falha crítica. |
