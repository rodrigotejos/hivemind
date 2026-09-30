# Business Rules: Unit 1 - Backend SQLite Schema (`security_runs`), Persistence & Lockout

## BR-01: Idempotência & Trava Concorrente por Banco
- **Regra**: Antes de inicializar qualquer novo pipeline de segurança, o sistema deve consultar se existe algum registro em `security_runs` para o `projectId` com `status = 'running'`.
- **Efeito**:
  - Se existir: A rota `POST /api/projects/:projectId/security/scan` é imediatamente rejeitada com `HTTP 409 Conflict`, retornando o payload:
    ```json
    {
      "success": false,
      "error": "SCAN_ALREADY_RUNNING",
      "message": "Auditoria de segurança já em andamento para este projeto.",
      "activeRun": {
        "runId": "run_sec_...",
        "phase": 2,
        "phaseName": "Varredura Estrita de Segredos e .env",
        "agentName": "Delta (Security - Red Team)"
      }
    }
    ```
  - Se não existir: Um novo `run_id` é gerado, inserido na tabela `security_runs` e adicionado ao conjunto em memória `activeScans`.

---

## BR-02: Progressão Atômica de Fases com Gravação Síncrona
- **Regra**: A cada transição de fase ($1 \rightarrow 2 \rightarrow 3 \rightarrow 4 \rightarrow 5$), o `SecurityPipelineService` deve gravar a atualização no SQLite **antes** de emitir o evento `security_phase_progress` pelo Socket.IO.
- **Efeito**: Garante que qualquer cliente que recarregue a página (F5) no exato instante da transição encontrará o estado atualizado no banco de dados, sem divergência entre WebSocket e REST.

---

## BR-03: Duração Realista de Inspeção por Fase
- **Regra**: Para proporcionar visibilidade real ao operador e permitir a leitura clara das verificações do ticker, cada fase terá uma duração de inspeção técnica de 2.000ms a 2.500ms (com suporte a override para testes imediatos `stepDelayMs: 0`).
- **Efeito**: O scan completo tem duração total de aproximadamente 10 a 12 segundos, tempo ideal para acompanhar os agentes Delta Security e Beta Blue Team em ação sem sensação de travamento ou execução falsa em 3 segundos.

---

## BR-04: Sincronização Atômica na Fase 5 com a Tabela `projects`
- **Regra**: Ao alcançar a Fase 5 (`status = 'completed'`), a transação do banco deve simultaneamente:
  1. Atualizar a linha em `security_runs` com `phase: 5`, `status: 'completed'`, `score: finalScore` e `completed_at: CURRENT_TIMESTAMP`.
  2. Atualizar a linha correspondente em `projects` com `security_score: finalScore`, `security_rating: finalRating` e `last_security_audit_at: CURRENT_TIMESTAMP`.
  3. Remover o `projectId` do conjunto `activeScans`.

---

## BR-05: Tratamento Transacional de Falhas
- **Regra**: Se ocorrer qualquer erro inesperado durante as fases 1 a 4:
  1. A linha em `security_runs` deve ser atualizada para `status: 'failed'`, gravando a mensagem de erro em `current_check`.
  2. O evento de erro deve ser emitido via Socket.IO.
  3. A trava de concorrência (`activeScans`) é liberada imediatamente no bloco `finally`, permitindo que o usuário tente novamente.
