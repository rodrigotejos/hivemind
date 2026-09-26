import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MessagePrioritySchema } from '../../src/services/ai-manager';

describe('Structured Output Schema (US-5, Security Baseline)', () => {
  test('deve validar payload correto de MessagePriority', () => {
    const validData = {
      priority: 'high',
      needsHuman: true,
      conflictRisk: false,
      reasoning: 'Risco de timeout detectado na infraestrutura.',
      category: 'blocker',
      tags: ['infra', 'timeout']
    };

    const parsed = MessagePrioritySchema.safeParse(validData);
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.strictEqual(parsed.data.priority, 'high');
      assert.strictEqual(parsed.data.needsHuman, true);
    }
  });

  test('deve rejeitar payload com prioridade inválida', () => {
    const invalidData = {
      priority: 'ultra-mega-urgent', // Prioridade inexistente
      needsHuman: true,
      conflictRisk: false
    };

    const parsed = MessagePrioritySchema.safeParse(invalidData);
    assert.strictEqual(parsed.success, false);
  });

  test('deve rejeitar payload sem campos obrigatórios', () => {
    const missingData = {
      reasoning: 'Faltando priority e flags'
    };

    const parsed = MessagePrioritySchema.safeParse(missingData);
    assert.strictEqual(parsed.success, false);
  });
});
