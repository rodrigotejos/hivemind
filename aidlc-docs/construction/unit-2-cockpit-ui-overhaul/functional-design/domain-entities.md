# Domain Entities: Unit 2 - Cockpit UI Overhaul & Expressive Status

## 1. SecurityPhaseStatus Interface
Representa o estado reativo consumido pelo frontend a partir do evento Socket.IO `security_phase_progress`:

```typescript
export interface SecurityPhaseState {
  phase: number; // 0 (idle/error), 1..5
  totalPhases: 5;
  phaseName: string;
  agentRole: string;
  agentName: string;
  currentCheck: string;
  targetFile?: string;
  findingsCountSoFar: number;
  scoreSoFar: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  timestamp?: string;
}
```

---

## 2. ProjectScorePresentation Interface
Modela a exibição do Score na barra superior e nos cards:

```typescript
export interface ProjectScorePresentation {
  score: number | null; // null quando projeto virgem de auditoria
  rating: string | null; // null quando virgem
  displayScore: string; // "75/100" ou "-- / 100"
  displayRating: string; // "B", "A+", ou "Pendente"
  badgeColorClass: string; // Estilos Tailwind baseados no score
  isAudited: boolean;
}
```

---

## 3. VerifiedMitigationStats Interface
Modela o cálculo matemático preciso do Card 4 de estatísticas no `SecurityAuditPanel`:

```typescript
export interface VerifiedMitigationStats {
  verifiedCount: number;
  mitigatedCount: number;
  totalResolutions: number; // verifiedCount + mitigatedCount
  percentage: number; // Math.round((verified / (mitigated + verified || 1)) * 100)
  displayBadge: string; // "33% (1/3)" ou "0% (0/0)"
}
```
