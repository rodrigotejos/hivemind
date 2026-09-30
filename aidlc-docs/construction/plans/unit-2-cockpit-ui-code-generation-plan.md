# Code Generation Plan: Unit 2 - Cockpit UI Overhaul & Status Expressivo

## Unit Context & Stories
- **Unit Name**: `unit-2-cockpit-ui-overhaul`
- **Stories Covered**: US-9 (Score Real no Topbar sem falso 100%), US-10 (Painel de Governança sem Caixa de Texto), US-11 (Pipeline de 5 Fases & Ticker ao Vivo)
- **Target Package**: `packages/web`
- **Single Source of Truth**: Este documento é o plano executivo para a geração de código da Unit 2.

---

## Detailed Implementation Steps

- [x] **Step 1: CockpitPanel Overhaul & 5-Phase Stepper**
  - **Files**: `packages/web/src/components/CockpitPanel.tsx`
  - **Action**:
    - Adicionar propriedade `project?: any` nas props para consumir `project.security_score` persistido.
    - Remover estado `goalInput` e o campo de input de texto `<input type="text" placeholder="Ex: Criar tela do Figma..." />`.
    - Renomear o card de coordenação para "Governança & Operações de Segurança".
    - Adicionar listener Socket.IO para `security_phase_progress` e armazenar em `phaseState`.
    - Renderizar a barra de 5 etapas com segmentos visuais iluminados (`Fase X de 5`) e o mini-ticker dinâmico informando o agente, arquivo sob inspeção (`targetFile`) e checagem ativa (`currentCheck`).
    - Substituir o botão principal por "Disparar Auditoria Adversarial" com indicador de progresso ativo.
    - Na barra superior de telemetria, eliminar o fallback `?? 100`: usar `score !== null ? `${score}/100` : '-- / 100'`.
  - **Story**: US-9, US-10, US-11

- [x] **Step 2: ProjectView Integration**
  - **Files**: `packages/web/src/pages/ProjectView.tsx`
  - **Action**: Passar `project={project}` como prop para `<CockpitPanel />`.
  - **Story**: US-9

- [x] **Step 3: SecurityAuditPanel Semantic Correction (Card 4)**
  - **Files**: `packages/web/src/components/SecurityAuditPanel.tsx`
  - **Action**: Alterar o Card 4 de estatísticas para "Mitigações Verificadas" com a fórmula percentual real `Math.round((verified / (mitigated + verified || 1)) * 100)%` e contagem `(${verified}/${totalResolutions})`, eliminando o rótulo fixo "100% Verificadas".
  - **Story**: US-9

- [x] **Step 4: PBT Invariants Test for Calculation Consistency**
  - **Files**: `packages/server/tests/pbt/unit-2-cockpit-invariants.test.ts`
  - **Action**: Validar invariante com `fast-check` para cálculo percentual de mitigações (0 a 100%, sem `NaN` ou divisão por zero para quaisquer valores inteiros).
  - **Story**: US-9

- [x] **Step 5: Frontend Build & Typecheck**
  - **Action**: Executar `npm run build -w web` para verificar compilação TypeScript e empacotamento Vite sem erros.

- [x] **Step 6: Code Generation Documentation & Summary**
  - **Files**: `aidlc-docs/construction/unit-2-cockpit-ui-overhaul/code/unit-2-summary.md`
  - **Action**: Documentar os arquivos modificados, novas props e evidências visuais.
