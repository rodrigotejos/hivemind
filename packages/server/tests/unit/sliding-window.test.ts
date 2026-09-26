import { test, describe } from 'node:test';
import assert from 'node:assert';
import { estimateTokenCount, calculateTokenWindow } from '../../src/services/ai-manager';

describe('Sliding Window & Token Budgeting (US-6)', () => {
  test('estimateTokenCount deve estimar ~4 caracteres por token', () => {
    assert.strictEqual(estimateTokenCount(''), 0);
    assert.strictEqual(estimateTokenCount('abcd'), 1);
    assert.strictEqual(estimateTokenCount('12345678'), 2);
  });

  test('calculateTokenWindow deve retornar mensagens inalteradas quando dentro do budget', async () => {
    const messages = [
      { id: '1', fromAgentId: 'user', content: 'Mensagem curta 1' },
      { id: '2', fromAgentId: 'agent', content: 'Mensagem curta 2' }
    ];

    const result = await calculateTokenWindow(messages, 1000);
    assert.strictEqual(result.isSummarized, false);
    assert.strictEqual(result.messages.length, 2);
  });

  test('calculateTokenWindow deve condensar histórico antigo quando excede o budget', async () => {
    // Cria 20 mensagens longas que extrapolam o budget de 100 tokens
    const messages = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      fromAgentId: i % 2 === 0 ? 'user' : 'agent',
      content: `Mensagem de histórico número ${i} com texto extenso detalhando decisões técnicas de arquitetura para preencher tokens.`
    }));

    const result = await calculateTokenWindow(messages, 100);
    assert.strictEqual(result.isSummarized, true);
    // A primeira mensagem deve ser a âncora de resumo
    assert.strictEqual(result.messages[0].id, 'summary-anchor');
    assert.ok(result.messages[0].content.includes('[RESUMO DO HISTÓRICO ANTERIOR]'));
    // O total retornado deve ser menor que o original
    assert.ok(result.messages.length < messages.length);
  });
});
