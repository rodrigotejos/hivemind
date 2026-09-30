# Business Logic Model: Unit 2 - Universal Stepper, Re-hidratação Pós-Refresh & Lockout Visual

## 1. Máquina de Estados do Stepper no Cliente

O componente visual `SecurityStepper` e os painéis de consumo operam sob a seguinte máquina de estados determinística:

```mermaid
stateDiagram-v2
    [*] --> Idle: Carga Inicial / Sem Runs Anteriores
    Idle --> Running: Disparo Local (POST /scan) ou Socket /run-status
    Running --> Running: Evento Fase 1..5 (Socket.IO ou Polling)
    Running --> Completed: Evento Fase 5 Concluída (status="completed")
    Running --> Failed: Erro no Pipeline (status="error")
    Completed --> Running: Novo Scan Iniciado
    Failed --> Running: Novo Scan Iniciado
```

### Descrição dos Estados
1. **Idle ("Pronto para Auditoria")**: Nenhuma auditoria ativa. Exibe as 5 barras cinzas e o timestamp do último scan realizado. Botão habilitado.
2. **Running ("Auditando...")**: Auditoria em progresso. A barra da fase atual pulsa em âmbar brilhante, as anteriores ficam verdes e as futuras ficam cinzas. O ticker mostra agente, arquivo e teste. Botão desabilitado com spinner.
3. **Completed ("Concluído")**: As 5 barras ficam verdes brilhantes. O ticker exibe "✓ Auditoria Concluída: Score X/100 persistido". Botão habilitado para novos scans.
4. **Failed ("Erro")**: A barra falhada é indicada em vermelho. Ticker alerta sobre o problema. Botão reabilitado.

---

## 2. Diagrama de Sequência: Re-hidratação Pós-Refresh (F5)

O cenário crítico reportado pelo usuário — dar refresh ou alternar abas durante uma auditoria — é resolvido com o seguinte fluxo:

```mermaid
sequenceDiagram
    autonumber
    actor User as Operador (Navegador)
    participant UI as SecurityAuditPanel
    participant API as Backend REST (/run-status)
    participant WS as Socket.IO Hub
    participant DB as SQLite (security_runs)

    User->>UI: Pressiona F5 (Refresh da Página)
    activate UI
    UI->>API: GET /api/projects/:id/security/run-status
    API->>DB: getLatestSecurityRun(projectId)
    DB-->>API: Row: phase=3, status="running", run_id="run_sec_..."
    API-->>UI: { isRunning: true, latestRun: { phase: 3, ... } }
    
    Note over UI: Re-hidratação Imediata:<br/>phaseProgress = Fase 3/5<br/>scanning = true (Botão travado)
    
    UI->>WS: join_project { projectId }
    WS-->>UI: Connected
    
    Note over WS,UI: Pipeline em background progride...
    WS-->>UI: Event security_phase_progress (Fase 4: Blue Team)
    UI->>UI: Atualiza Stepper para Fase 4/5
    
    WS-->>UI: Event security_phase_progress (Fase 5: Concluído)
    UI->>UI: Atualiza Stepper para 5/5 Verde
    UI->>API: GET /api/projects/:id/security (Atualiza Score & Findings)
    API-->>UI: Novo Score 100 A+ e lista atualizada
    deactivate UI
```

---

## 3. Diagrama de Sequência: Bloqueio Concorrente com HTTP 409

Se o usuário tentar disparar um scan enquanto outro já está em execução:

```mermaid
sequenceDiagram
    autonumber
    actor User as Operador
    participant UI as SecurityAuditPanel
    participant API as Backend REST (/scan)

    User->>UI: Clica em "Disparar Scan Red Team"
    UI->>API: POST /api/projects/:id/security/scan
    API-->>UI: HTTP 409 Conflict { error: "SCAN_ALREADY_RUNNING", activeRun }
    
    Note over UI: Intercepta 409 sem erro destrutivo:<br/>Atualiza phaseProgress com activeRun<br/>Trava botão "Auditando Código..."
    UI->>User: Exibe Stepper na fase ativa e botão desabilitado
```

---

## 4. Mapeamento de Props e Fluxo de Dados

| Campo UI | Fonte WebSocket (`security_phase_progress`) | Fonte REST (`/run-status`) | Fallback Inicial |
|---|---|---|---|
| `phase` | `data.phase` | `latestRun.phase` | `0` (Idle) ou `5` (se concluído) |
| `totalPhases` | `data.totalPhases` (5) | `latestRun.total_phases` (5) | `5` |
| `phaseName` | `data.phaseName` | `latestRun.phase_name` | `"Pronto para Auditoria"` |
| `currentCheck` | `data.currentCheck` | `latestRun.current_check` | `""` |
| `targetFile` | `data.targetFile` | `latestRun.target_file` | `undefined` |
| `scoreSoFar` | `data.scoreSoFar` | `latestRun.score` | `project.security_score` |
| `status` | `data.status` | `latestRun.status` | `'idle'` |
| `isScanning` | `data.status === 'running'` | `isRunning \|\| status === 'running'` | `false` |
