# Property-Based Testing (PBT) Execution Summary - Iterations 2 & 3

## Framework: `fast-check` v4
- **Test Files**:
  - `packages/server/tests/pbt/security-phase-invariants.test.ts` (Iteration 3 - Unit 1)
  - `packages/server/tests/pbt/unit-2-cockpit-invariants.test.ts` (Iteration 3 - Unit 2)
  - `packages/server/tests/pbt/unit-3-wiki-invariants.test.ts` (Iteration 3 - Unit 3)
  - `packages/server/tests/pbt/unit-1-invariants.test.ts` (Iteration 2 Baseline)
  - `packages/server/tests/pbt/unit-2-invariants.test.ts` (Iteration 2 Baseline)
  - `packages/server/tests/pbt/unit-3-invariants.test.ts` (Iteration 2 Baseline)
- **Execution Target**: Node.js test runner via `ts-node`

---

## Iteration 3 Invariants (Cockpit Security UI, Persistence & Wiki Search)

### Unit 1: Security Score Persistence & Phase Invariants
| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U1-01** | Score Clamping Invariant | 150 | PASSED | Para quaisquer deduções e severidades arbitrárias, o score resultante é sempre um inteiro delimitado em $[0, 100]$. |
| **PBT-U1-02** | Rating Monotonicity Invariant | 150 | PASSED | A classificação em letras (A/B/C/D/F) é estritamente monotônica: scores maiores nunca recebem letras piores. |
| **PBT-U1-03** | Phase Sequence Invariant | 100 | PASSED | O pipeline de segurança progride estritamente através das fases 1..5 sem pular etapas ou inverter ordem. |

### Unit 2: Cockpit UI & Calculation Invariants
| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U2-03** | Mitigation Percentage Boundedness | 250 | PASSED | Para quaisquer quantidades não-negativas de mitigações e verificações, a porcentagem é um inteiro finito $\in [0, 100]$ e nunca NaN. |
| **PBT-U2-04** | Zero False-Positive Score Formatting | 100 | PASSED | Scores nulos ou indefinidos NUNCA formatam como "100/100", exibindo estritamente `-- / 100`. |

### Unit 3: Wiki Search & Regex Invariants
| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U3-01** | RegExp Escaping Robustness | 300 | PASSED | Para qualquer string arbitrária com caracteres de controle regex, `new RegExp(escapeRegExp(query))` compila sem `SyntaxError`. |
| **PBT-U3-02** | Content Preservation & Identity | 250 | PASSED | A aplicação e posterior remoção das marcações `<mark>` preserva 100% da integridade textual original. |
| **PBT-U3-03** | Match Counting Boundedness & Exact Occurrence | 200 | PASSED | A contagem de correspondências é sempre um inteiro $\ge 0$ e identifica com precisão todas as ocorrências. |

---

## Iteration 2 Baseline Invariants (Regressão Validada)

| Invariant ID | Nome | Execuções | Status | Detalhes |
| :--- | :--- | :--- | :--- | :--- |
| **PBT-U1-01** | Token Budget Invariant | 100 | PASSED | Contexto acumulado no chat respeita o orçamento de tokens. |
| **PBT-U1-02** | Schema Conformance Invariant | 100 | PASSED | Payloads válidos satisfazem schemas Zod. |
| **PBT-U1-03** | Template Variable Sanitization | 100 | PASSED | Tags de prompt injection são 100% neutralizadas. |
| **PBT-U1-04** | Heartbeat Lease Monotonicity | 100 | PASSED | Leases ativas com ociosidade `<= duration` nunca expiram. |
| **PBT-U2-01** | Backoff Monotonicity & Ceiling | 100 | PASSED | Exponential backoff respeita teto de 60.000ms. |
| **PBT-U2-02** | Jitter Boundedness Invariant | 100 | PASSED | Jitter permanece no intervalo $\pm 15\%$. |
| **PBT-U2-03** | Streaming Chunk Concatenation | 100 | PASSED | Chunks acumulados reconstroem o texto original. |
| **PBT-U2-04** | Max Retry Bound Invariant | 100 | PASSED | Máximo de 5 tentativas antes de declarar exaustão. |
| **PBT-U3-01** | Sensitive Files Blocking Invariant | 100 | PASSED | Arquivos confidenciais são bloqueados antes de commits. |
| **PBT-U3-02** | Safe Files Non-Blocking Invariant | 100 | PASSED | Arquivos legítimos nunca são falsamente bloqueados. |
| **PBT-U3-03** | Conventional Commits Syntax | 100 | PASSED | Mensagens geradas seguem padrão semântico. |
| **PBT-U3-04** | Resilient Backup Branch Name | 100 | PASSED | Branches de backup atendem à especificação do Git. |

---

## Resumo Geral de PBT
- **Total de Invariantes Testadas**: 20 invariantes
- **Total de Amostras Geradas Proceduralmente**: 2.550 execuções com `fast-check`
- **Taxa de Aprovação**: 100% (0 falhas, 0 regressões)
