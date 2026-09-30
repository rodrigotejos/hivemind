# Business Logic Model: Unit 1 - Backend SQLite Schema (`security_runs`), Persistence & Lockout

## 1. Sequence Diagram: Scan Execution, Persistence & Refresh Re-connection

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário / Tech Lead
    participant Web as Frontend (Web)
    participant API as Express Router (/security)
    participant Svc as SecurityPipelineService
    participant DB as SQLite (database.sqlite)
    participant SIO as Socket.IO (project room)

    Note over User,Web: 1. Disparo de Auditoria
    User->>Web: Clica em "Disparar Scan Red Team"
    Web->>API: POST /api/projects/:id/security/scan
    API->>DB: getActiveSecurityRun(projectId)
    alt Scan ativo existente
        DB-->>API: run_sec_123 (status='running')
        API-->>Web: 409 Conflict { error: 'SCAN_ALREADY_RUNNING' }
        Web->>Web: Desabilita botões e exibe spinner ativo
    else Sem scan ativo
        DB-->>API: null
        API->>Svc: runPipeline(projectId)
        Svc->>DB: createSecurityRun({ id, phase: 1, status: 'running' })
        API-->>Web: 200 OK { success: true, runId, totalPhases: 5 }
        
        loop Para cada fase (1..5) com delay realista de 2s
            Svc->>DB: updateSecurityRunProgress(runId, phase, agent, check, file)
            Svc->>SIO: emit('security_phase_progress', payload)
            SIO-->>Web: Atualiza Stepper (Fase N/5) e Ticker
        end
        
        Note over User,Web: Cenário de Page Refresh (F5) no meio da Fase 3
        User->>Web: Usuário pressiona F5 / Recarrega página
        Web->>API: GET /api/projects/:id/security/run-status
        API->>DB: getLatestSecurityRun(projectId)
        DB-->>API: { id: 'run_sec_123', phase: 3, status: 'running', ... }
        API-->>Web: 200 OK { latestRun: { phase: 3, status: 'running' }, isRunning: true }
        Web->>Web: Stepper re-hidrata imediatamente na Fase 3/5
        Web->>SIO: join_project(projectId)
        Note over Svc,Web: Socket.IO entrega Fase 4 e 5 normalmente!
        
        Note over Svc,DB: Fase 5 (Conclusão)
        Svc->>DB: updateSecurityRunProgress(runId, phase: 5, status: 'completed')
        Svc->>DB: updateProjectSecurityScore(projectId, score, rating)
        Svc->>SIO: emit('security_phase_progress', { status: 'completed' })
        Svc->>SIO: emit('security_updated', { summary })
        SIO-->>Web: Stepper marca "Concluído 100%" e atualiza Score
    end
```

---

## 2. Assinaturas de Métodos no `queries.ts`

```typescript
// 1. Criar novo registro de execução
export function createSecurityRun(data: {
  id: string;
  projectId: string;
  phase?: number;
  totalPhases?: number;
  phaseName: string;
  status?: 'running' | 'completed' | 'failed';
  agentRole: 'delta-security' | 'beta-backend' | 'system';
  agentName: string;
  currentCheck?: string;
  targetFile?: string;
  findingsCount?: number;
  score?: number | null;
}): SecurityRun;

// 2. Atualizar progresso de fase
export function updateSecurityRunProgress(
  runId: string,
  updates: Partial<Omit<SecurityRun, 'id' | 'project_id' | 'started_at'>>
): SecurityRun | null;

// 3. Buscar o run mais recente (ativo ou concluído)
export function getLatestSecurityRun(projectId: string): SecurityRun | null;

// 4. Buscar run ativo (status = 'running')
export function getActiveSecurityRun(projectId: string): SecurityRun | null;
```

---

## 3. Endpoints REST da Unit 1

### A. `GET /api/projects/:projectId/security/run-status`
- **Finalidade**: Re-idratação do frontend no load da página, F5 e alternância de abas.
- **Resposta 200 OK**:
  ```json
  {
    "success": true,
    "projectId": "travel_fun",
    "isRunning": true,
    "latestRun": {
      "id": "run_sec_1790726369_a8f1",
      "project_id": "travel_fun",
      "phase": 3,
      "total_phases": 5,
      "phase_name": "Simulação Adversarial OWASP (Red Team)",
      "status": "running",
      "agent_role": "delta-security",
      "agent_name": "Delta (Security - Red Team)",
      "current_check": "Simulando injeção NoSQL, bypass de autenticação e timing attacks...",
      "target_file": "src/routes/security.ts",
      "findings_count": 5,
      "score": 75,
      "started_at": "2026-09-29 21:05:00",
      "updated_at": "2026-09-29 21:05:04",
      "completed_at": null
    }
  }
  ```

### B. `POST /api/projects/:projectId/security/scan` (Evoluído com Lockout 409)
- **Verificação de Entrada**:
  - Consulta `queries.getActiveSecurityRun(projectId)` e `pipeline.isScanRunning(projectId)`.
  - Se ativo: retorna `409 Conflict` imediatamente com dados do run em andamento.
  - Se livre: inicia novo run no banco e em background com delay realista de 2.000ms a 2.500ms por etapa.
