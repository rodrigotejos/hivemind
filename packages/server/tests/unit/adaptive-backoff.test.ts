import { test, describe } from 'node:test';
import assert from 'node:assert';
import { classifyLLMError, calculateAdaptiveDelay, executeWithAdaptiveBackoff } from '../../src/services/ai-manager';

describe('Adaptive Backoff & Auto-Recovery (US-2, US-3)', () => {
  test('classifyLLMError deve identificar 429 / Resource Exhausted com base de 10s', () => {
    const error429 = new Error('GoogleGenerativeAI: 429 Resource Exhausted: Quota exceeded for quota metric');
    const result = classifyLLMError(error429);
    assert.strictEqual(result.type, 'RATE_LIMIT_429');
    assert.strictEqual(result.baseDelayMs, 10000);
  });

  test('classifyLLMError deve identificar erros transitórios 503 com base de 2s', () => {
    const error503 = new Error('503 Service Unavailable: Model is temporarily overloaded');
    const result = classifyLLMError(error503);
    assert.strictEqual(result.type, 'TRANSIENT_503');
    assert.strictEqual(result.baseDelayMs, 2000);
  });

  test('classifyLLMError deve extrair instrução explícita de Retry-After', () => {
    const errorRetryAfter = new Error('Rate limit exceeded. Please retry after 18s');
    const result = classifyLLMError(errorRetryAfter);
    assert.strictEqual(result.type, 'RATE_LIMIT_429');
    assert.strictEqual(result.retryAfterMs, 18000);
    assert.strictEqual(result.baseDelayMs, 18000);
  });

  test('calculateAdaptiveDelay deve aplicar exponential backoff e teto de 60s', () => {
    // Attempt 1: ~10s
    const delay1 = calculateAdaptiveDelay(10000, 1, 0); // sem jitter
    assert.strictEqual(delay1, 10000);

    // Attempt 2: ~20s
    const delay2 = calculateAdaptiveDelay(10000, 2, 0);
    assert.strictEqual(delay2, 20000);

    // Attempt 3: ~40s
    const delay3 = calculateAdaptiveDelay(10000, 3, 0);
    assert.strictEqual(delay3, 40000);

    // Attempt 4+: limitado a 60s
    const delay4 = calculateAdaptiveDelay(10000, 4, 0);
    assert.strictEqual(delay4, 60000);
  });

  test('executeWithAdaptiveBackoff deve se recuperar com sucesso de erro transitório', async () => {
    let callCount = 0;
    const flakyOperation = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('503 Service Unavailable: overloaded');
      }
      return 'Sucesso após recuperação';
    };

    const result = await executeWithAdaptiveBackoff(
      flakyOperation,
      { projectId: 'test_proj', agentId: 'test_agent', agentRole: 'backend' },
      3
    );

    assert.strictEqual(result, 'Sucesso após recuperação');
    assert.strictEqual(callCount, 2);
  });
});
