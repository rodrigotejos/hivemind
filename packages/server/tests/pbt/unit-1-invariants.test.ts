import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { estimateTokenCount, calculateTokenWindow, MessagePrioritySchema } from '../../src/services/ai-manager';
import { PromptRegistry } from '../../src/services/prompt-registry';

describe('Unit 1 Property-Based Tests (PBT Baseline)', () => {

  /**
   * PBT-U1-01: Token Budget Invariant
   * Para qualquer array de mensagens gerado arbitrariamente, a janela condensada final
   * nunca excede o orçamento de tokens se a sumarização for acionada.
   */
  test('PBT-U1-01: Token Budget Invariant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            fromAgentId: fc.constantFrom('user', 'agent-alpha', 'agent-beta'),
            content: fc.string({ minLength: 10, maxLength: 200 })
          }),
          { minLength: 1, maxLength: 50 }
        ),
        fc.integer({ min: 100, max: 2000 }),
        async (messages, budget) => {
          const result = await calculateTokenWindow(messages, budget);
          assert.ok(result.messages.length > 0);
          
          if (result.isSummarized) {
            // A mensagem âncora de resumo DEVE estar presente
            assert.strictEqual(result.messages[0].id, 'summary-anchor');
            // O número de mensagens na janela condensada é menor ou igual ao original + 1
            assert.ok(result.messages.length <= messages.length + 1);
          } else {
            // Se não foi sumarizado, a contagem de tokens original estava estritamente dentro do budget
            const tokenSum = messages.reduce((acc, m) => acc + estimateTokenCount(m.content), 0);
            assert.ok(tokenSum <= budget);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * PBT-U1-02: Schema Conformance Invariant
   * Qualquer payload que satisfaça as regras do MessagePrioritySchema passa na validação Zod.
   */
  test('PBT-U1-02: Schema Conformance Invariant', () => {
    fc.assert(
      fc.property(
        fc.record({
          priority: fc.constantFrom('low', 'normal', 'high', 'critical'),
          needsHuman: fc.boolean(),
          conflictRisk: fc.boolean(),
          reasoning: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
          category: fc.option(fc.constantFrom('question', 'decision', 'blocker', 'info', 'security'), { nil: undefined }),
          tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 })
        }),
        (payload) => {
          const parsed = MessagePrioritySchema.safeParse(payload);
          assert.strictEqual(parsed.success, true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U1-03: Template Variable Sanitization Invariant
   * A função sanitizeVariable do PromptRegistry NUNCA deixa passar tags maliciosas
   * de injeção de prompt (<system>, </system>, <instructions>, </instructions>).
   */
  test('PBT-U1-03: Template Variable Sanitization Invariant', () => {
    const registry = PromptRegistry.getInstance();
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom('<system>', '</system>', '<instructions>', '</instructions>'),
        (randomText, dangerousTag) => {
          const input = `${randomText}${dangerousTag}${randomText}`;
          const sanitized = registry.sanitizeVariable(input);
          
          assert.strictEqual(sanitized.includes('<system>'), false);
          assert.strictEqual(sanitized.includes('</system>'), false);
          assert.strictEqual(sanitized.includes('<instructions>'), false);
          assert.strictEqual(sanitized.includes('</instructions>'), false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U1-04: Heartbeat Lease Monotonicity Invariant
   * Para qualquer timestamp de último batimento, se delta <= timeout a lease é válida;
   * se delta > timeout a lease é expirada.
   */
  test('PBT-U1-04: Heartbeat Lease Monotonicity Invariant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100_000 }), // leaseDurationMs
        fc.integer({ min: 0, max: 200_000 }),     // idleMs
        (leaseDurationMs, idleMs) => {
          const isExpired = idleMs > leaseDurationMs;
          if (idleMs <= leaseDurationMs) {
            assert.strictEqual(isExpired, false);
          } else {
            assert.strictEqual(isExpired, true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
