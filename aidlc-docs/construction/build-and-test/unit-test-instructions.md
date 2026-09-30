# Unit Test Execution Instructions: Hivemind AI-DLC (Iteration 3)

## Visão Geral da Suite de Testes
A suíte de testes unitários e de propriedades cobre tanto as novas funcionalidades da Iteração 3 quanto as regressões das iterações anteriores, garantindo a integridade dos contratos de segurança, governança e UX.

---

## 1. Execução dos Testes da Iteração 3

Execute os comandos a partir de `packages/server/`:

### A. Persistência de Score & Pipeline Determinístico (Unit 1)
```powershell
$env:NODE_ENV="test"; npx ts-node -T tests/unit/security-persistence.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/pbt/security-phase-invariants.test.ts
```
- **Testes Unitários**: 4 testes validando auto-migração, queries SQLite, bloqueio concorrente (idempotência) e persistência atômica.
- **PBTs**: 3 invariantes de score bounds [0..100], monotonicidade de rating e sequência 1..5 com `fast-check`.

### B. Cockpit UI & Cálculos Matemáticos (Unit 2)
```powershell
$env:NODE_ENV="test"; npx ts-node -T tests/pbt/unit-2-cockpit-invariants.test.ts
```
- **PBTs**: 2 invariantes validando porcentagem de mitigações verificadas e formatação sem falsos positivos (`-- / 100`).

### C. Wiki Técnica com Scroll & Busca (Unit 3)
```powershell
$env:NODE_ENV="test"; npx ts-node -T tests/pbt/unit-3-wiki-invariants.test.ts
```
- **PBTs**: 3 invariantes testando sanitização estrita de RegExp contra SyntaxError, preservação de 100% dos caracteres originais e contagem de correspondências.

---

## 2. Execução da Suite de Regressão Completa
```powershell
$env:NODE_ENV="test"; npx ts-node -T tests/unit/prompt-registry.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/unit/adaptive-backoff.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/unit/heartbeat-lease-manager.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/unit/sliding-window.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/unit/structured-output.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/unit/git-supervisor.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/pbt/unit-1-invariants.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/pbt/unit-2-invariants.test.ts
$env:NODE_ENV="test"; npx ts-node -T tests/pbt/unit-3-invariants.test.ts
```

---

## 3. Critérios de Aprovação
- **Testes Unitários**: 100% de aprovação (0 falhas).
- **Property-Based Testing (PBT)**: 100% de aprovação em todos os 3.100 cenários gerados pelo `fast-check`.
