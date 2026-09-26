# Property-Based Testing (PBT) Execution Summary

## Framework: `fast-check` v4
- **Test File**: `packages/server/tests/pbt/unit-1-invariants.test.ts`
- **Execution Target**: Node.js test runner via `ts-node`

## Invariant Properties Verified

| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U1-01** | Token Budget Invariant | 50 | PASSED | Para mensagens arbitrárias e orçamentos variados, o tamanho do contexto final retornado pelo `calculateTokenWindow` respeita os limites de segurança estipulados. |
| **PBT-U1-02** | Schema Conformance Invariant | 100 | PASSED | Payloads arbitrários satisfazendo os tipos do schema Zod são sempre validados como `success: true`. |
| **PBT-U1-03** | Template Variable Sanitization | 100 | PASSED | Inserção aleatória de tags de escape como `<system>` e `<instructions>` é 100% neutralizada pela sanitização. |
| **PBT-U1-04** | Heartbeat Lease Monotonicity | 100 | PASSED | Leases ativas com ociosidade `<= duration` nunca expiram; ociosidade `> duration` sempre expiram de forma determinística. |

**Total de Amostras Geradas**: 350 casos de teste gerados proceduralmente sem nenhuma falha de regressão.
