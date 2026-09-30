import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';

describe('Unit 2 Property-Based Tests: Cockpit UI & Calculation Invariants', () => {

  // Função pura que reflete o cálculo do Card 4 de Mitigações Verificadas
  function calculateMitigationPercentage(verified: number, mitigated: number): number {
    const total = verified + mitigated;
    if (total <= 0) return 0;
    return Math.round((verified / total) * 100);
  }

  // Função pura que reflete a formatação do Score do Topbar sem falso 100%
  function formatTopbarScore(score: number | null | undefined): string {
    if (score === null || score === undefined) {
      return '-- / 100';
    }
    return `${score}/100`;
  }

  /**
   * PBT-U2-03: Mitigation Percentage Boundedness & Finite Math Invariant
   * Para quaisquer números arbitrários não-negativos de mitigações e verificações,
   * a porcentagem resultante é sempre um inteiro finito contido em [0, 100] e nunca NaN.
   */
  test('PBT-U2-03: Mitigation Percentage Boundedness Invariant (0 <= pct <= 100)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // verified
        fc.integer({ min: 0, max: 10000 }), // mitigated
        (verified, mitigated) => {
          const pct = calculateMitigationPercentage(verified, mitigated);

          assert.ok(Number.isFinite(pct), 'Porcentagem deve ser finita');
          assert.ok(!Number.isNaN(pct), 'Porcentagem não pode ser NaN');
          assert.ok(pct >= 0, `Porcentagem deve ser >= 0, obtido: ${pct}`);
          assert.ok(pct <= 100, `Porcentagem deve ser <= 100, obtido: ${pct}`);

          if (verified === 0) {
            assert.strictEqual(pct, 0, 'Se verified é 0, pct deve ser 0');
          }
          if (mitigated === 0 && verified > 0) {
            assert.strictEqual(pct, 100, 'Se todas as resoluções foram verificadas, pct deve ser 100');
          }
        }
      ),
      { numRuns: 250 }
    );
  });

  /**
   * PBT-U2-04: Zero False-Positive Presentation Invariant
   * Scores nulos ou indefinidos NUNCA produzem a string "100/100", mas estritamente "-- / 100".
   */
  test('PBT-U2-04: Zero False-Positive Score Formatting Invariant', () => {
    // Casos nulos/undefined
    assert.strictEqual(formatTopbarScore(null), '-- / 100');
    assert.strictEqual(formatTopbarScore(undefined), '-- / 100');

    // Casos válidos
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (validScore) => {
          const formatted = formatTopbarScore(validScore);
          assert.strictEqual(formatted, `${validScore}/100`);
          assert.ok(formatted.endsWith('/100'));
        }
      ),
      { numRuns: 100 }
    );
  });
});
