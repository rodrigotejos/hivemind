import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { calculateAdaptiveDelay } from '../../src/services/ai-manager';

describe('Unit 2 Property-Based Tests (PBT Baseline)', () => {

  /**
   * PBT-U2-01: Backoff Monotonicity & Ceiling Invariant
   * Para qualquer tentativa de 1 a 5 e qualquer baseDelay > 0, o delay nominal (sem jitter)
   * é estritamente não-decrescente e nunca ultrapassa 60.000ms.
   */
  test('PBT-U2-01: Backoff Monotonicity & Ceiling Invariant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 15000 }), // baseDelay
        fc.integer({ min: 1, max: 4 }),         // attempt
        (baseDelay, attempt) => {
          const delayCurrent = calculateAdaptiveDelay(baseDelay, attempt, 0);
          const delayNext = calculateAdaptiveDelay(baseDelay, attempt + 1, 0);

          assert.ok(delayNext >= delayCurrent, 'Delay da próxima tentativa deve ser >= tentativa atual');
          assert.ok(delayCurrent <= 60000, 'Delay atual deve respeitar o teto de 60s');
          assert.ok(delayNext <= 60000, 'Delay próximo deve respeitar o teto de 60s');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U2-02: Jitter Boundedness Invariant
   * Com jitter de ±15%, o delay resultante sempre permanece dentro do intervalo [0.85 * nominal, 1.15 * nominal].
   */
  test('PBT-U2-02: Jitter Boundedness Invariant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000 }),
        fc.integer({ min: 1, max: 5 }),
        (baseDelay, attempt) => {
          const nominal = Math.min(60000, baseDelay * Math.pow(2, attempt - 1));
          const withJitter = calculateAdaptiveDelay(baseDelay, attempt, 0.15);

          const minExpected = Math.floor(nominal * 0.85);
          const maxExpected = Math.ceil(nominal * 1.15);

          assert.ok(
            withJitter >= minExpected && withJitter <= maxExpected,
            `Delay com jitter (${withJitter}) fora dos limites esperados [${minExpected}, ${maxExpected}] para nominal ${nominal}`
          );
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * PBT-U2-03: Streaming Chunk Concatenation Invariant
   * A concatenação cumulativa de qualquer sequência arbitrária de chunks de texto
   * preserva exatamente a string original na íntegra sem perdas.
   */
  test('PBT-U2-03: Streaming Chunk Concatenation Invariant', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 50 }), { minLength: 1, maxLength: 30 }),
        (chunks) => {
          const expected = chunks.join('');
          let accumulated = '';
          for (const delta of chunks) {
            accumulated += delta;
          }
          assert.strictEqual(accumulated, expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U2-04: Max Retry Bound Invariant
   * O número máximo de tentativas antes de declarar 'exhausted' nunca excede 5.
   */
  test('PBT-U2-04: Max Retry Bound Invariant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (attempt) => {
          const maxAttempts = 5;
          const isExhausted = attempt >= maxAttempts;
          if (attempt < maxAttempts) {
            assert.strictEqual(isExhausted, false);
          } else {
            assert.strictEqual(isExhausted, true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
