# Unit of Work to User Story Mapping

## Story Allocation Matrix

| Unidade | Histórias de Usuário Mapeadas | Descrição dos Objetivos Principais |
|---|---|---|
| **`UOW-01`** (SDK & Skills) | `US-02` (Catálogo de Skills Especializadas) | Exportar tipos TypeScript e estruturar as 7 skills em `.agent/skills/`. |
| **`UOW-02`** (LangGraph Engine) | `US-05` (Máquina de Estados & Roteamento), `US-06` (Anti-Loop & Convergência) | Motor de grafo cíclico, nós de agentes, Supervisor e checkpoints SQLite. |
| **`UOW-03`** (Bridge Daemon) | `US-03` (Despacho para `agy` CLI), `US-04` (Concorrência Segura) | Execução de subprocessos locais do Antigravity CLI com fila e circuit breaker. |
| **`UOW-04`** (LangSmith Telemetry) | `US-09` (Rastreamento End-to-End), `US-10` (Ingestão de Telemetria de CLI) | Tracing com `langsmith` SDK, spans e métricas de custos/tokens. |
| **`UOW-05`** (Setup & Backup) | `US-01` (Auto-Setup AI-DLC/MCP), `US-11` (Snapshot S3), `US-12` (Restauração) | Assistente de onboarding de projetos e backup/restauração em S3. |
| **`UOW-06`** (Cockpit HITL UI) | `US-07` (Pausa/Retomada HITL), `US-08` (Resolução de Blockers) | Painel React 19 com controles de loop, cards de `interrupt()` e telemetria. |

---

## Extension Coverage by Unit

- **Security Baseline (SECURITY-01 a 06)**: Coberto em `UOW-02` (SQL parametrizado), `UOW-03` (isolamento seguro de processos) e `UOW-05` (criptografia de snapshots).
- **Resiliency Baseline (RESILIENCY-01 a 15)**: Coberto em `UOW-02` (checkpoints no SQLite), `UOW-03` (circuit breaker) e `UOW-05` (S3 disaster recovery).
- **Property-Based Testing (PBT-01 a 09)**: Testes de invariantes e round-trip aplicados em todas as 6 unidades.
