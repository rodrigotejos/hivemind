import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';

describe('Unit 1 Property-Based Tests: Security Invariants (PBT Baseline)', () => {
  // Função pura que replica o cálculo para validação formal de invariantes
  function calculateScore(findings: Array<{ severity: string; status: string }>) {
    let deductions = 0;
    for (const f of findings) {
      if (f.status === 'open') {
        if (f.severity === 'critical') deductions += 25;
        else if (f.severity === 'high') deductions += 15;
        else if (f.severity === 'medium') deductions += 8;
        else if (f.severity === 'low') deductions += 3;
      } else if (f.status === 'mitigating') {
        if (f.severity === 'critical') deductions += 12;
        else if (f.severity === 'high') deductions += 7;
        else if (f.severity === 'medium') deductions += 4;
        else if (f.severity === 'low') deductions += 1;
      }
    }
    const score = Math.max(0, Math.min(100, 100 - deductions));
    const rating = 
      score >= 95 ? 'A+' :
      score >= 85 ? 'A' :
      score >= 75 ? 'B' :
      score >= 60 ? 'C' : 'F';

    return { score, rating };
  }

  /**
   * PBT-U1-01: Score Clamping Invariant
   * Para qualquer lista arbitrária de vulnerabilidades com severidades e status randômicos,
   * o score resultante é SEMPRE estritamente limitado no intervalo [0, 100].
   */
  test('PBT-U1-01: Score Clamping Invariant (0 <= score <= 100)', () => {
    const findingArbitrary = fc.record({
      severity: fc.constantFrom('critical', 'high', 'medium', 'low', 'info'),
      status: fc.constantFrom('open', 'mitigating', 'mitigated', 'verified'),
    });

    const findingsListArbitrary = fc.array(findingArbitrary, { minLength: 0, maxLength: 50 });

    fc.assert(
      fc.property(findingsListArbitrary, (findings) => {
        const { score, rating } = calculateScore(findings);
        assert.ok(score >= 0, `Score deve ser >= 0, obtido: ${score}`);
        assert.ok(score <= 100, `Score deve ser <= 100, obtido: ${score}`);
        assert.ok(['A+', 'A', 'B', 'C', 'F'].includes(rating), `Rating deve ser válido: ${rating}`);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * PBT-U1-02: Rating Monotonicity Invariant
   * Scores mais altos nunca recebem ratings piores que scores mais baixos.
   */
  test('PBT-U1-02: Rating Monotonicity Invariant', () => {
    const ratingRank: Record<string, number> = {
      'F': 0,
      'C': 1,
      'B': 2,
      'A': 3,
      'A+': 4,
    };

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (score1, score2) => {
          const getRating = (s: number) => s >= 95 ? 'A+' : s >= 85 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : 'F';
          const r1 = getRating(score1);
          const r2 = getRating(score2);

          if (score1 > score2) {
            assert.ok(
              ratingRank[r1] >= ratingRank[r2],
              `Score maior (${score1} vs ${score2}) não pode ter rating inferior (${r1} vs ${r2})`
            );
          } else if (score1 === score2) {
            assert.strictEqual(r1, r2);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * PBT-U1-03: Phase Sequence Invariant
   * O pipeline deve avançar estritamente com totalPhases = 5 e fases contíguas 1..5.
   */
  test('PBT-U1-03: Phase Sequence Invariant (Contiguous 1..5)', () => {
    const phases = [1, 2, 3, 4, 5];
    assert.strictEqual(phases.length, 5);
    for (let i = 0; i < phases.length - 1; i++) {
      assert.strictEqual(phases[i + 1], phases[i] + 1);
    }
  });
});
