# Domain Entities: Unit 2 - Universal Stepper, Re-hidratação Pós-Refresh & Lockout Visual

## 1. Entidades e Tipagens do Cliente (Frontend)

### 1.1. `SecurityStepItem`
Define a configuração estática e os metadados de cada uma das 5 fases do pipeline de segurança determinístico:

```typescript
export interface SecurityStepItem {
  num: number;
  label: string;
  name: string;
  defaultAgentRole: 'delta-security' | 'backend';
  defaultAgentName: string;
  description: string;
}

export const SECURITY_PIPELINE_STEPS: SecurityStepItem[] = [
  {
    num: 1,
    label: '1. Rotas & CORS',
    name: 'Auditoria de Superfície de Ataque & CORS',
    defaultAgentRole: 'delta-security',
    defaultAgentName: 'Delta Security (Red Team)',
    description: 'Varredura de rotas expostas e validação de políticas CORS permissivas',
  },
  {
    num: 2,
    label: '2. Segredos .env',
    name: 'Detecção de Segredos & Credenciais Expostas',
    defaultAgentRole: 'delta-security',
    defaultAgentName: 'Delta Security (Red Team)',
    description: 'Inspeção de tokens, senhas hardcoded e vazamentos em variáveis de ambiente',
  },
  {
    num: 3,
    label: '3. Red Team (OWASP)',
    name: 'Auditoria de Injeção & OWASP Top 10',
    defaultAgentRole: 'delta-security',
    defaultAgentName: 'Delta Security (Red Team)',
    description: 'Testes de Command Injection, SQLi, XSS e Path Traversal',
  },
  {
    num: 4,
    label: '4. Blue Team (Patch)',
    name: 'Análise de Defesa & Sanidade de Mitigações',
    defaultAgentRole: 'backend',
    defaultAgentName: 'Beta Backend (Blue Team)',
    description: 'Validação de sanitizadores, prepared statements e defesas ativas',
  },
  {
    num: 5,
    label: '5. Verificação & DB',
    name: 'Verificação Final & Persistência de Score',
    defaultAgentRole: 'backend',
    defaultAgentName: 'Beta Backend (Blue Team)',
    description: 'Cálculo de rating ponderado e gravação atômica no SQLite',
  },
];
```

---

### 1.2. `SecurityPhaseProgressPayload`
Contrato do evento recebido via WebSocket (`security_phase_progress`) e mantido no estado do componente:

```typescript
export interface SecurityPhaseProgressPayload {
  projectId: string;
  runId?: string;
  phase: number;
  totalPhases: number;
  phaseName: string;
  agentRole: string;
  agentName: string;
  currentCheck: string;
  targetFile?: string;
  findingsCountSoFar: number;
  scoreSoFar: number;
  status: 'running' | 'completed' | 'failed' | 'error';
  timestamp?: string;
}
```

---

### 1.3. `SecurityRunStatusResponse`
Contrato da resposta do endpoint `GET /api/projects/:projectId/security/run-status`:

```typescript
export interface SecurityRunStatusResponse {
  success: boolean;
  projectId: string;
  isRunning: boolean;
  latestRun: {
    id: string;
    project_id: string;
    phase: number;
    total_phases: number;
    phase_name: string;
    status: 'running' | 'completed' | 'failed';
    agent_role: string;
    agent_name: string;
    current_check: string;
    target_file: string | null;
    findings_count: number;
    score: number;
    started_at: string;
    updated_at: string;
    completed_at: string | null;
  } | null;
  error?: string;
}
```

---

### 1.4. Mapeamento de `latestRun` (SQLite) $\rightarrow$ `SecurityPhaseProgressPayload` (UI)

Quando o frontend carrega a partir do endpoint `/run-status`, a função de conversão garante consistência imediata:

```typescript
export function mapRunToProgress(run: SecurityRunStatusResponse['latestRun']): SecurityPhaseProgressPayload | null {
  if (!run) return null;
  return {
    projectId: run.project_id,
    runId: run.id,
    phase: run.phase,
    totalPhases: run.total_phases,
    phaseName: run.phase_name,
    agentRole: run.agent_role,
    agentName: run.agent_name,
    currentCheck: run.current_check,
    targetFile: run.target_file || undefined,
    findingsCountSoFar: run.findings_count,
    scoreSoFar: run.score,
    status: run.status === 'failed' ? 'error' : run.status,
    timestamp: run.updated_at,
  };
}
```
