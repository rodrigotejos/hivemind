# Business Rules - Unit 1: Infraestrutura de LLM & Segurança

## 1. Regras de Structured Output e Segurança (US-5)

### BR-SO-01: Validação Estrita de Schema (Security Baseline)
- Toda saída gerada pela LLM que envolva classificação, triagem ou tomada de decisão deve aderir a um schema Zod explícito.
- É proibido o uso de expressões regulares soltas (ex: `replace(/```json/g, '')`) como mecanismo primário de parse.
- O formato de schema deve ser injetado nativamente através do parâmetro `responseSchema` da API Gemini (`ChatGoogleGenerativeAI`).

### BR-SO-02: Reflection Loop de Correção Automática (Resiliency Baseline)
- Se a resposta retornada pela LLM falhar na validação do Zod:
  1. O sistema deve capturar a mensagem detalhada do erro gerada pelo Zod (caminho do campo e motivo).
  2. Uma mensagem de feedback deve ser reenviada à LLM: `"Your output violated the required JSON schema at path [field]: [issue]. Please fix and output ONLY the corrected JSON."`.
  3. Limite máximo: 2 tentativas de reflexão.
  4. Caso atinja 2 falhas consecutivas, uma exceção controlada `StructuredSchemaError` é emitida, registrando auditoria de segurança.

### BR-SO-03: Sanitização de Variáveis de Template (Security Baseline)
- Variáveis inseridas em templates de prompt (`${var}`) devem ser validadas e escapar caracteres delimitadores que possam induzir fuga de contexto ou jailbreak de prompt.

---

## 2. Regras de Sliding Window e Token Budgeting (US-6)

### BR-TK-01: Threshold de Orçamento de Contexto
- O orçamento de contexto padrão para cada chamada do agente é de 80% do limite máximo suportado pelo modelo configurado (ex: para gemini-3.7-flash, budget de segurança de 800.000 tokens; para flash-lite, 250.000 tokens).

### BR-TK-02: Condensação Recursiva
- Se a contagem total de tokens das mensagens do histórico exceder o orçamento:
  - As mensagens são divididas em `histórico antigo` e `janela recente` (mínimo de 10 mensagens recentes preservadas).
  - O `histórico antigo` é sumarizado por uma chamada leve à LLM (`gemini-3.5-flash-lite`).
  - O resumo condensado é prefixado como mensagem de contexto inicial estruturada: `"[RESUMO DO HISTÓRICO ANTERIOR]: <conteúdo condensado>"`.
  - A soma dos tokens (`resumo + mensagens recentes + system prompt`) nunca deve exceder o budget estipulado.

---

## 3. Regras de Desacoplamento de Prompts (US-7)

### BR-PR-01: Estrutura Canônica de Prompt
- Prompts não podem existir como strings literais dentro do código TypeScript (`nodes.ts` ou `ai-manager.ts`).
- Devem residir no diretório `packages/server/prompts/*.json`.
- Cada arquivo de prompt deve conter chaves obrigatórias: `id`, `role`, `description`, `version`, `messages`.

### BR-PR-02: Hot-Reloading Transparente
- O `PromptRegistry` deve checar o carimbo de alteração de arquivo (`mtime`) em cada solicitação de template. Se o arquivo foi modificado no disco, o cache interno é atualizado sem reiniciar o servidor.

---

## 4. Regras de Resiliência e Lease de Heartbeat (US-8)

### BR-HB-01: Intervalo e Expiração de Lease
- O subprocesso do daemon deve emitir um sinal de batimento cardíaco (`heartbeat`) a cada 10 segundos.
- O tempo máximo de tolerância sem batimento cardíaco é de 60 segundos (`leaseTimeout = 60000ms`).

### BR-HB-02: Encerramento Gracioso e Forçado
- Se o lease expirar (60s sem heartbeat):
  1. O coordenador emite sinal `SIGTERM` ao PID do processo filho.
  2. Um temporizador de carência de 5 segundos (`gracePeriod = 5000ms`) é ativado.
  3. Se o processo não terminar após os 5 segundos, o sinal `SIGKILL` é disparado imediatamente.
  4. O estado da tarefa é marcado como `FAILED_TIMEOUT_DEAD_LEASE` no banco de dados e notificado ao Cockpit.

---

## 5. Propriedades Invariantes para Property-Based Testing (PBT Baseline)

| ID | Propriedade Invariante | Descrição |
| :--- | :--- | :--- |
| **PBT-U1-01** | *Token Budget Invariant* | Para qualquer array arbitrário de mensagens gerado por geradores aleatórios, o contexto final produzido por `calculateTokenWindow` NUNCA ultrapassa o `maxTokens`. |
| **PBT-U1-02** | *Schema Conformance Invariant* | Para qualquer payload que passe com sucesso pelo validador estruturado, o objeto retornado sempre satisfaz `schema.safeParse(data).success === true`. |
| **PBT-U1-03** | *Template Interpolation Integrity* | Para qualquer mapa de chave-valor válido, todas as tags `${key}` são substituídas e o resultado não contém delimitadores não escapados. |
| **PBT-U1-04** | *Heartbeat Lease Monotonicity* | Se `now - lastHeartbeat <= 60000`, a verificação de expiração do lease NUNCA deve sinalizar término. Se `now - lastHeartbeat > 60000`, SEMPRE deve sinalizar expiração. |
