# Code Generation Plan: Unit 2 - Frontend Universal Stepper, Re-hidratação Pós-Refresh & Lockout Visual

## Unit Context & Stories
- **Unit Name**: `unit-2-universal-stepper-frontend`
- **Stories Covered**: US-14 (Resiliência e Re-hidratação pós-refresh F5), US-15 (Bloqueio Concorrente Visual), US-16 (Stepper Universal no `SecurityAuditPanel`)
- **Target Package**: `packages/web`
- **Single Source of Truth**: Este documento é o plano executivo detalhado para a geração de código da Unit 2.

---

## Detailed Implementation Steps

- [x] **Step 1: Reusable Component `SecurityStepper.tsx`**
  - **Files**: `packages/web/src/components/SecurityStepper.tsx`
  - **Action**:
    - Criar o componente modular `SecurityStepper` exportando as interfaces `SecurityStepperProps` e `SecurityPhaseProgressPayload`.
    - Implementar a renderização dos 5 passos determinísticos:
      1. `1. Rotas & CORS`
      2. `2. Segredos .env`
      3. `3. Red Team (OWASP)`
      4. `4. Blue Team (Patch)`
      5. `5. Verificação & DB`
    - Estilização expressiva:
      - Fase ativa: barra âmbar pulsante (`bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]`), texto âmbar.
      - Fase concluída: barra verde esmeralda (`bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]`), texto zinc-400.
      - Fase pendente: barra neutra (`bg-zinc-800`), texto zinc-600.
    - Mini-ticker dinâmico em tempo real:
      - Indicador pulsante (`animate-ping bg-amber-400`), badge "Fase X/5: {phaseName}", arquivo alvo (`targetFile` em ciano) e teste ativo (`currentCheck` em zinc-300).
      - Estado concluído: "✓ Auditoria Concluída: Score X/100 persistido".
      - Estado ocioso: "Pronto para Auditoria" ou último horário formatado.
  - **Story**: US-16

- [x] **Step 2: Integration & Rehydration in `SecurityAuditPanel.tsx`**
  - **Files**: `packages/web/src/components/SecurityAuditPanel.tsx`
  - **Action**:
    - Integrar o componente `<SecurityStepper />` no topo do painel, entre o card de score/resumo e a grade de cards de severidade.
    - Implementar consulta inicial a `GET /api/projects/:projectId/security/run-status` no `useEffect`:
      - Se `latestRun` reportar `status === 'running'`, re-hidratar `phaseProgress` e setar `scanning = true`.
      - Se `latestRun` reportar `status === 'completed'`, exibir as 5 fases como concluídas com o score gravado.
    - Adicionar ouvinte Socket.IO para `security_phase_progress`:
      - Atualizar o stepper em tempo real conforme cada fase avança (delay de ~2s por etapa).
      - Ao receber `status === 'completed'`, desativar `scanning = false` e chamar `fetchSecurityData()` para recarregar os findings e o score oficial.
    - **Remover completamente** o `setTimeout(3000)` legado em `handleTriggerScan`.
    - Desabilitar botão "Disparar Scan Red Team" enquanto `scanning === true` ou `phaseProgress?.status === 'running'`.
    - Tratar status `HTTP 409 Conflict` caso haja scan ativo, capturando `data.activeRun` e travando a interface sem crash.
  - **Story**: US-14, US-15, US-16

- [x] **Step 3: Synchronization & Deduplication in `CockpitPanel.tsx`**
  - **Files**: `packages/web/src/components/CockpitPanel.tsx`
  - **Action**:
    - Re-hidratar `phaseProgress` e `isScanning` a partir de `GET /api/projects/:projectId/security/run-status` na carga inicial e intervalos de polling.
    - Substituir a marcação visual inline pelo componente compartilhado `<SecurityStepper />`.
    - Sincronizar os botões de disparo de segurança para respeitar o estado de concorrência.
  - **Story**: US-14, US-15

- [x] **Step 4: Frontend Type Checking & Build Verification**
  - **Files**: `packages/web`
  - **Action**:
    - Executar `npm run build -w web` (TypeScript + Vite) e garantir 0 erros de compilação ou tipagem.
  - **Story**: US-14, US-15, US-16

- [x] **Step 5: Code Generation Summary Documentation**
  - **Files**: `aidlc-docs/construction/unit-2-universal-stepper-frontend/code/unit-2-summary.md`
  - **Action**:
    - Documentar arquivos criados e modificados, contratos de props, fluxos de re-hidratação pós-refresh e resultados da compilação.
  - **Story**: US-14, US-15, US-16
