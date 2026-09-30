# Business Rules: Unit 1 - Backend Persistence & 5-Phase Security Pipeline

## BR-01: Idempotência do Scan de Segurança
* **Regra**: Disparos sucessivos de `POST /api/projects/:projectId/security/scan` enquanto uma auditoria estiver em andamento para o mesmo projeto não devem duplicar processos nem gerar estados corrompidos.
* **Comportamento**: Se um scan já estiver ativo na memória para o `projectId`, o endpoint retorna status `409 Conflict` ou ignora suavemente retornando `{ running: true, message: 'Scan já em andamento' }`.

## BR-02: Garantia de Limites Matemáticos do Score (Security Baseline)
* **Regra**: O valor gravado em `security_score` DEVE estar estritamente contido no intervalo fechado $[0, 100]$.
* **Invariante PBT**:
  $$\forall \text{ findings } F, \quad 0 \le \text{calculateSecurityScore}(F) \le 100$$
* Qualquer resultado inferior a 0 deve ser limitado a 0 (*clamped*). Qualquer resultado superior a 100 deve ser limitado a 100.

## BR-03: Nullability e Estado Inicial
* **Regra**: Para projetos sem auditoria prévia, `security_score` e `security_rating` DEVEM ser `null` no SQLite.
* **Comportamento da API**: O endpoint `GET /api/projects/:id` deve retornar explicitamente `null` nesses campos quando virgens de scan, permitindo que a camada de UI identifique ausência de auditoria e renderize `-- / 100` em vez de presumir 100%.

## BR-04: Transição Sequencial Estrita de Fases
* **Regra**: O pipeline deve emitir as fases estritamente em ordem crescente ($1 \to 2 \to 3 \to 4 \to 5$).
* Cada evento de fase deve informar o `currentCheck` textual de forma expressiva e descritiva para o frontend.
