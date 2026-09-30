# Domain Entities: Unit 1 - Backend Persistence & 5-Phase Security Pipeline

## 1. Project Entity Extension
A entidade central `Project` armazena a postura de segurança persistida no SQLite:

```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
  shared_context?: string;
  path?: string;
  status: 'active' | 'paused' | 'archived';
  security_score: number | null; // Clamped [0, 100], null quando não auditado
  security_rating: 'A+' | 'A' | 'B' | 'C' | 'F' | null;
  last_security_audit_at: string | null; // ISO 8601 string
  created_at: string;
  updated_at: string;
}
```

---

## 2. Security Phase Progress Entity
Representa o progresso emitido em tempo real pelo orquestrador do backend via canal Socket.IO `project_${projectId}`:

```typescript
export interface SecurityPhaseProgress {
  projectId: string;
  phase: 1 | 2 | 3 | 4 | 5;
  totalPhases: 5;
  phaseName: string;
  agentRole: 'delta-security' | 'beta-backend' | 'gamma-qa' | 'system';
  agentName: string;
  currentCheck: string;
  targetFile?: string;
  findingsCountSoFar: number;
  scoreSoFar: number;
  timestamp: string;
}
```

---

## 3. Phase Definitions Mapping
O pipeline é estruturado em 5 fases imutáveis:

| Fase | Nome | Agente Responsável | Foco Principal |
|---|---|---|---|
| **1** | Mapeamento de Rotas, CORS & Headers | `delta-security` | Express middleware, rotas expostas e CORS |
| **2** | Varredura Estrita de Segredos | `delta-security` | Arquivos `.env`, chaves de API e tokens expostos |
| **3** | Simulação Adversarial OWASP | `delta-security` (Red Team) | Vetores A01 (IDOR), A03 (Injeção), A04 (Timing) |
| **4** | Defesas & Mitigações | `beta-backend` (Blue Team) | Schemas Zod/Joi, sanitização e contramedidas |
| **5** | Verificação Formal & Persistência | `gamma-qa` / `system` | Invariantes matemáticas e gravação atômica no SQLite |
