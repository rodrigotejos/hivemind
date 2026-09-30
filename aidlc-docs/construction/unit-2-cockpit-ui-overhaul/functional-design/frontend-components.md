# Frontend Components Design: Unit 2 - Cockpit UI Overhaul & Expressive Status

## 1. Component Hierarchy & Updates

```text
packages/web/src/
├── components/
│   ├── CockpitPanel.tsx           [REFORMULADO]
│   │   ├── Topbar Telemetry       [Score Real do Projeto, sem falso 100%]
│   │   ├── Governance Header      [Substitui "Coordenação Multi-Agente"]
│   │   ├── SecurityPhaseStepper   [NOVO: 5 segmentos visuais + ticker ao vivo]
│   │   └── Controls Row           [Model, Reasoning, Disparar Auditoria (Sem Textbox)]
│   │
│   └── SecurityAuditPanel.tsx     [REFINADO]
│       ├── Header Score Ring      [Score Real sem fallback 100]
│       └── Card 4 de Estatísticas [Título "Mitigações Verificadas" com % real (ex: 33% 1/3)]
```

---

## 2. CockpitPanel Component Specification

### Props
```typescript
interface CockpitPanelProps {
  projectId: string;
  apiUrl: string;
  project?: {
    security_score?: number | null;
    security_rating?: string | null;
    last_security_audit_at?: string | null;
  };
  sessionId?: string;
  sessionTitle?: string;
  initialModel?: string;
  initialReasoningLevel?: string;
  compact?: boolean;
}
```

### Removals & Additions
- **Removido**:
  - `goalInput` state (`useState('')`)
  - `<input type="text" placeholder="Ex: Criar tela do Figma..." />`
  - Botão genérico "Disparar Agentes / Iniciar Tarefa"
- **Adicionado**:
  - `phaseState` state (`SecurityPhaseState | null`)
  - Listener Socket.IO: `socket.on('security_phase_progress', (data) => setPhaseState(data))`
  - **Stepper Visual de 5 Fases**:
    ```tsx
    <div className="grid grid-cols-5 gap-1.5 my-2">
      {[1, 2, 3, 4, 5].map(step => (
        <div 
          key={step} 
          className={`h-1.5 rounded-full transition-all duration-300 ${
            (phaseState?.phase || 0) >= step 
              ? 'bg-gradient-to-r from-indigo-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
              : 'bg-zinc-800'
          }`}
        />
      ))}
    </div>
    ```
  - **Live Dynamic Ticker**:
    Exibe a fase atual, agente ativo, arquivo sob análise (`targetFile`) e a checagem (`currentCheck`).
  - **Botão de Ação Direta**:
    "Disparar Auditoria Adversarial" com ícone animado e bloqueio durante execução.

---

## 3. SecurityAuditPanel Component Specification
- No Card 4 de estatísticas:
  ```tsx
  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
    <div>
      <span className="text-[11px] text-zinc-400 block">Mitigações Verificadas</span>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-sm font-bold text-emerald-400">
          {summary?.statusCounts.verified || 0}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">
          ({Math.round(((summary?.statusCounts.verified || 0) / ((summary?.statusCounts.mitigated || 0) + (summary?.statusCounts.verified || 0) || 1)) * 100)}%)
        </span>
      </div>
    </div>
    <CheckCircle size={20} className="text-emerald-400/60" />
  </div>
  ```
