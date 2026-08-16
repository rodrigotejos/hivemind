# Unit of Work Plan

## Purpose
Decompor o sistema em 6 unidades de trabalho modulares e independentes, alinhadas aos pacotes do monorepo, às histórias de usuário e às dependências técnicas.

---

## Execution Checklist

- [x] **Step 1: Definição e Escopo das Unidades de Trabalho**
  - [x] Unit 1: `@ai-dlc/sdk` & Catálogo de Skills Especializadas (`.agent/skills/`)
  - [x] Unit 2: LangGraph State Machine & Supervisor Engine (`@ai-dlc/server`)
  - [x] Unit 3: Antigravity Bridge Daemon & Execução de Subprocessos (`@ai-dlc/server`)
  - [x] Unit 4: LangSmith Observability & Telemetria de Tokens (`@ai-dlc/server`)
  - [x] Unit 5: Assistente de Auto-Setup & Backup S3 Resiliente (`@ai-dlc/server`)
  - [x] Unit 6: Cockpit HITL no Dashboard React (`web`)
  - [x] Gerar `aidlc-docs/inception/application-design/unit-of-work.md`

- [x] **Step 2: Mapeamento de Dependências entre Unidades**
  - [x] Elaborar matriz de precedência e ordem de execução
  - [x] Gerar `aidlc-docs/inception/application-design/unit-of-work-dependency.md`

- [x] **Step 3: Mapeamento de Histórias de Usuário para Unidades (Story Map)**
  - [x] Mapear `US-01` a `US-12` para as 6 unidades correspondentes
  - [x] Gerar `aidlc-docs/inception/application-design/unit-of-work-story-map.md`

- [x] **Step 4: Validação de Completude e Prontidão para Construction**
  - [x] Garantir cobertura de todas as 12 histórias e 3 extensões (Security, Resiliency, PBT)
  - [x] Atualizar `aidlc-docs/aidlc-state.md` e `aidlc-docs/audit.md`
