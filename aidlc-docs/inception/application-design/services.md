# Services

## 1. LangGraphOrchestratorService
**Responsibilities**:
- Substituir a função monolítica em `nodes.ts` por um serviço mais robusto.
- Orquestrar a sequência: `PromptRegistry.getPrompt` -> `AIManager.calculateTokenWindow` -> `AIManager.streamChat` / `AIManager.executeWithRetry`.
- Atuar como o "Controller" emitindo side-effects pelo `SocketGateway`.

## 2. CommitApprovalService
**Responsibilities**:
- Escutar os eventos de resposta do Cockpit (quando o usuário clica em "Aprovar Commit" ou "Rejeitar").
- Invocar o `GitSupervisor` para aplicar o Merge ou deletar a branch dependendo da decisão do Human Supervisor.

## 3. TelemetryTokenService
**Responsibilities**:
- Manter controle rígido dos gastos da API e repassar ao `AIManager` o tamanho dos arrays de mensagens para auxiliar na técnica de Sliding Window.
