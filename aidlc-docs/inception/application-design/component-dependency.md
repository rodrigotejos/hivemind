# Component Dependencies

## Dependency Matrix

| Component | Depends On | Reason |
| :--- | :--- | :--- |
| **AIManager** | `PromptRegistry` | Buscar as regras do sistema (hot-reload) |
| **AIManager** | `RecoveryCache` | Salvar tentativas no Redis/MemCache |
| **LangGraphOrchestrator** | `AIManager` | Executar o modelo e receber o AsyncGenerator streamado |
| **LangGraphOrchestrator** | `SocketGateway` | Emitir deltas (`typing`) e `status` para a UI |
| **LangGraphOrchestrator** | `GitSupervisor` | Se ao finalizar houver File Edits, invoca o CLI do git |
| **SocketGateway** | `Cockpit UI` (Client) | Contrato de rede via WebSockets (emissão/escuta) |
| **CommitApprovalService** | `SocketGateway` | Aguardar o callback (Aprovação) via Socket |
| **CommitApprovalService** | `GitSupervisor` | Rodar `mergeAndCommit` na aprovação |

## Data Flow: Real-time Streaming
1. `LangGraph` inicia o Node do Agente.
2. Invoca `SocketGateway.emitAgentStatus('thinking')`.
3. Pede ao `PromptRegistry` o system prompt em MD.
4. Pede ao `AIManager` o `streamChat`.
5. Para cada chunk recebido via yield, emite `SocketGateway.emitAgentTyping(delta)`.
6. Terminado, emite `SocketGateway.emitAgentStatus('idle')`.

## Data Flow: Git Auto-Commit
1. Agentes aplicam alterações em arquivos numa branch local (via LangChain tools).
2. `LangGraph` finaliza rodada.
3. Invoca `GitSupervisor.generateDiff()`.
4. `SocketGateway.emitGitDiff(diffText)` para a UI do Cockpit.
5. Cockpit renderiza Modal de aprovação.
6. Humano clica em "Approve". UI emite Socket Event `git_commit_approved`.
7. `CommitApprovalService` captura o evento e chama `GitSupervisor.mergeAndCommit()`.
