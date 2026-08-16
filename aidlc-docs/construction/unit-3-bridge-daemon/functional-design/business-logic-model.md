# Unit 3 Functional Design: Antigravity Bridge Daemon & Subprocess Execution

## 1. Bridge Daemon Architecture & Workflow

O `BridgeDaemon` conecta eventos em tempo real do Hivemind ao CLI do Antigravity (`agy`), permitindo que agentes locais processem tarefas de forma autônoma.

### 1.1 Fila de Execução e Concorrência
- **Capacidade Máxima**: 2 processos simultâneos por padrão para evitar contenção de CPU/IO.
- **Timeout**: 120 segundos por execução. Se estourar, o processo é encerrado de forma segura (`SIGKILL`/`SIGTERM`) e marcado como timeout.

### 1.2 Circuit Breaker por Papel de Agente
- **Threshold**: 3 falhas consecutivas colocam o circuit breaker do agente no estado `OPEN` por 60 segundos.
- **Recuperação**: Transita para `HALF_OPEN` e testa uma execução. Se suceder, fecha o circuito (`CLOSED`).

### 1.3 Sanitização e Isolamento de Ambiente (SECURITY-03)
- Subprocessos herdam apenas variáveis de ambiente seguras.
- Argumentos de comando nunca são passados via interpolação de string em shell vulnerável; utiliza-se array de argumentos com `child_process.spawn`.
