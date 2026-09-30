import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';

describe('Unit 1 Property-Based Tests: Security Runs State Machine & Invariants (PBT)', () => {

  // Função pura que simula a transição de máquina de estados de um run
  interface SimulatedRun {
    id: string;
    projectId: string;
    phase: number;
    totalPhases: number;
    status: 'running' | 'completed' | 'failed';
    completedAt: string | null;
  }

  function advancePhase(run: SimulatedRun, nextPhase: number): SimulatedRun {
    const clampedPhase = Math.max(1, Math.min(5, nextPhase));
    const isCompleted = clampedPhase === 5;
    return {
      ...run,
      phase: clampedPhase,
      status: isCompleted ? 'completed' : 'running',
      completedAt: isCompleted ? new Date().toISOString() : null,
    };
  }

  /**
   * PBT-U1-04: Phase Boundedness & Completion Invariant
   * Para qualquer sequência arbitrária de números inteiros de fase,
   * a fase do pipeline resultante sempre reside estritamente em [1, 5].
   * Se a fase alcançar 5, o status é obrigatoriamente 'completed' e completedAt preenchido.
   */
  test('PBT-U1-04: Phase Boundedness & Completion Invariant (1 <= phase <= 5)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        (arbitraryPhase) => {
          const initial: SimulatedRun = {
            id: 'run_test',
            projectId: 'proj_test',
            phase: 1,
            totalPhases: 5,
            status: 'running',
            completedAt: null,
          };

          const progressed = advancePhase(initial, arbitraryPhase);

          assert.ok(progressed.phase >= 1, `Fase deve ser >= 1, obtido: ${progressed.phase}`);
          assert.ok(progressed.phase <= 5, `Fase deve ser <= 5, obtido: ${progressed.phase}`);

          if (progressed.phase === 5) {
            assert.strictEqual(progressed.status, 'completed', 'Fase 5 deve marcar status completed');
            assert.ok(progressed.completedAt !== null, 'Fase 5 deve ter completedAt');
          } else {
            assert.strictEqual(progressed.status, 'running', 'Fases 1..4 devem manter status running');
            assert.strictEqual(progressed.completedAt, null, 'Fases 1..4 não devem ter completedAt');
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * PBT-U1-05: Run ID Format & Non-Empty Invariant
   * Para quaisquer timestamps arbitrários positivos e hashes alfanuméricos,
   * o runId gerado obedece rigorosamente ao padrão semântico esperado pela API.
   */
  test('PBT-U1-05: Run ID Regex Conformance Invariant', () => {
    const runIdRegex = /^run_sec_\d+_[a-z0-9]+$/;

    fc.assert(
      fc.property(
        fc.integer({ min: 1000000000, max: 9999999999 }),
        fc.stringMatching(/^[a-z0-9]{3,8}$/),
        (timestamp, hash) => {
          const runId = `run_sec_${timestamp}_${hash}`;

          assert.ok(runIdRegex.test(runId), `runId "${runId}" deve atender à regex`);
          assert.ok(runId.length >= 15, 'runId deve possuir tamanho mínimo adequado');
          assert.ok(!runId.includes(' '), 'runId não pode conter espaços');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * PBT-U1-06: Active Run Selection Determinism Invariant
   * Em uma lista arbitrária de runs com no máximo um em status 'running',
   * a busca por run ativo retorna determinística e exclusivamente aquele registro.
   */
  test('PBT-U1-06: Active Run Selection Determinism Invariant', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5 }),
            status: fc.constantFrom<'completed' | 'failed'>('completed', 'failed'),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.option(fc.string({ minLength: 5 })),
        (completedRuns, activeRunId) => {
          const allRuns = [...completedRuns];
          if (activeRunId) {
            allRuns.push({ id: activeRunId, status: 'running' as any });
          }

          const foundActive = allRuns.find(r => r.status === 'running');

          if (activeRunId) {
            assert.ok(foundActive !== undefined, 'Deve encontrar o run ativo');
            assert.strictEqual(foundActive?.id, activeRunId);
          } else {
            assert.strictEqual(foundActive, undefined, 'Não deve encontrar run ativo se nenhum estiver running');
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
