# Functional Design Plan - Unit 2: Frontend Universal Stepper, Re-hidratação Pós-Refresh & Lockout Visual

## Context & Stories
- **Unit**: Unit 2 (Frontend Universal Stepper, Re-hidratação Pós-Refresh & Lockout Visual)
- **Stories**: US-14 (Resiliência e Re-hidratação pós-refresh F5), US-15 (Bloqueio Concorrente Visual), US-16 (Stepper Universal no `SecurityAuditPanel`)
- **Target Package**: `packages/web`

---

## Detailed Plan Steps
- [x] **Step 1: Frontend Components Design (`frontend-components.md`)**:
  - Especificação do componente compartilhado `SecurityStepper.tsx` com os 5 passos determinísticos e ticker dinâmico.
  - Especificação da integração em `SecurityAuditPanel.tsx` (incorporação do Stepper, re-hidratação via `/run-status`, remoção do `setTimeout(3000)` e bloqueio visual do botão).
  - Especificação da sincronização em `CockpitPanel.tsx` (re-hidratação do `latestRun` no carregamento e uso do `SecurityStepper`).
- [x] **Step 2: Domain Entities (`domain-entities.md`)**:
  - Modelagem das tipagens de estado frontend: `SecurityStepItem`, `SecurityRunStatusResponse`, `SecurityPhaseProgressPayload` e `SecurityStepperProps`.
- [x] **Step 3: Business Rules (`business-rules.md`)**:
  - Definição das regras de negócio do cliente: visibilidade universal (BR-06), re-hidratação pós-refresh (BR-07), eliminação de delays artificiais (BR-08), bloqueio concorrente visual (BR-09) e tratamento resiliente de HTTP 409 (BR-10).
- [x] **Step 4: Business Logic Model (`business-logic-model.md`)**:
  - Diagramas de sequência para re-hidratação pós-refresh (F5), máquina de estados do componente Stepper, fluxo de eventos Socket.IO e mapeamento de dados.
- [ ] **Step 5: Formal Review & Approval Gate**:
  - Apresentar o design funcional para aprovação do usuário e transição para o Code Generation da Unit 2.
