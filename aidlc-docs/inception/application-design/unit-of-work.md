# Units of Work

Com base na abordagem Full-Stack orientada por Risco/Prioridade, o sistema foi decomposto nas seguintes Unidades de Trabalho (Units of Work). O desenvolvimento será **Sequencial**, garantindo estabilidade antes de avançar para a próxima unidade.

## Unit 1: Infraestrutura de LLM & Segurança (Alta Prioridade)
- **Scope**: Estabilizar o core da comunicação com a API do Google Gemini.
- **Responsibilities**: 
  - Refatorar o parser nativo (remover Regex JSON) e implementar Structured Outputs.
  - Implementar lógica de Sliding Window no `AIManager` calculada através de tokens.
  - Desacoplar os prompts do sistema para uma pasta dedicada lida em runtime (`PromptRegistry`).
  - Implementar o backoff assíncrono e retry sem dar timeout precoce no daemon.
- **Affected Components**: `AIManager`, `PromptRegistry`, `LangGraphOrchestratorService` (parcial).

## Unit 2: Cockpit Streaming & Auto-Recovery UI (Média Prioridade)
- **Scope**: Atualizar a interface do Cockpit para consumir estados reativos do backend.
- **Responsibilities**:
  - Implementar o AsyncGenerator no `AIManager` para retornar chunks ao invés de mensagens inteiras.
  - Atualizar o `SocketGateway` no backend para emitir eventos de `typing`, `thinking`, `retrying`.
  - Refatorar o Frontend (React Cockpit) para concatenar os deltas no estado das mensagens e exibir os toasts de recovery.
- **Affected Components**: `AIManager` (extensão streaming), `SocketGateway`, Frontend React, `RecoveryCache`.

## Unit 3: Git Supervisor & Commit Approval (Baixa Prioridade)
- **Scope**: Fechar o loop de feedback do agente permitindo que eles modifiquem código e o usuário aprove.
- **Responsibilities**:
  - Implementar o CLI runner no `GitSupervisor` para criar branches e extrair *diffs*.
  - Emitir o evento de Diff via Sockets para a UI.
  - Renderizar o modal visual de Diff no Cockpit Frontend.
  - Capturar o evento de aprovação da UI e executar o merge commit.
- **Affected Components**: `GitSupervisor`, `CommitApprovalService`, Frontend React.
