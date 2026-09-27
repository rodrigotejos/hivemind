# Property-Based Testing (PBT) Execution Summary - Iteration 2

## Framework: `fast-check` v4
- **Test Files**:
  - `packages/server/tests/pbt/unit-1-invariants.test.ts`
  - `packages/server/tests/pbt/unit-2-invariants.test.ts`
- **Execution Target**: Node.js test runner via `ts-node`

---

## Unit 1 Invariant Properties Verified

| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U1-01** | Token Budget Invariant | 50 | PASSED | Para mensagens arbitrárias e orçamentos variados, o tamanho do contexto final retornado pelo `calculateTokenWindow` respeita os limites de segurança estipulados. |
| **PBT-U1-02** | Schema Conformance Invariant | 100 | PASSED | Payloads arbitrários satisfazendo os tipos do schema Zod são sempre validados como `success: true`. |
| **PBT-U1-03** | Template Variable Sanitization | 100 | PASSED | Inserção aleatória de tags de escape como `<system>` e `<instructions>` é 100% neutralizada pela sanitização. |
| **PBT-U1-04** | Heartbeat Lease Monotonicity | 100 | PASSED | Leases ativas com ociosidade `<= duration` nunca expiram; ociosidade `> duration` sempre expiram de forma determinística. |

---

## Unit 2 Invariant Properties Verified

| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U2-01** | Backoff Monotonicity & Ceiling | 100 | PASSED | Para qualquer tentativa 1 a 5 e baseDelay > 0, o delay nominal é estritamente não-decrescente e nunca ultrapassa o teto de 60.000ms. |
| **PBT-U2-02** | Jitter Boundedness Invariant | 100 | PASSED | Com jitter de ±15%, o delay resultante com ruído randômico sempre permanece contido no intervalo estrito `[0.85 * nominal, 1.15 * nominal]`. |
| **PBT-U2-03** | Streaming Chunk Concatenation | 100 | PASSED | Para qualquer sequência arbitrária de chunks de texto (letras, pontuação, acentuação), a concatenação acumulada no cliente é idêntica à string gerada pelo modelo. |
| **PBT-U2-04** | Max Retry Bound Invariant | 50 | PASSED | Quando todas as operações falham, o executor adaptativo realiza estritamente `maxAttempts` (padrão 5) antes de declarar exaustão e pausar o grafo. |

---

## Summary
- **Total de Invariantes Testadas**: 8
- **Total de Amostras Geradas Proceduralmente**: 700 casos de teste gerados com `fast-check`
- **Taxa de Sucesso**: 100% (0 falhas, 0 regressões)
