import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';

describe('Unit 3 Property-Based Tests: Wiki Search & Regex Invariants', () => {

  // Funções puras idênticas à implementação do frontend em ProjectView.tsx
  function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatchesToString(text: string, query: string): string {
    if (!query.trim()) return text;
    const escaped = escapeRegExp(query.trim());
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part) =>
      part.toLowerCase() === query.trim().toLowerCase()
        ? `<mark>${part}</mark>`
        : part
    ).join('');
  }

  function stripHighlight(highlighted: string): string {
    return highlighted.replace(/<\/?mark>/g, '');
  }

  function countMatches(text: string, query: string): number {
    if (!query.trim() || !text) return 0;
    const escaped = escapeRegExp(query.trim());
    const regex = new RegExp(escaped, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * PBT-U3-01: RegExp Escaping Robustness Invariant
   * Para qualquer string arbitrária (incluindo todos os caracteres de controle regex),
   * new RegExp(escapeRegExp(query)) NUNCA lança SyntaxError e faz match exato da query.
   */
  test('PBT-U3-01: RegExp Escaping Robustness Invariant (Zero SyntaxError)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (rawQuery) => {
          const escaped = escapeRegExp(rawQuery);

          // Invariante 1: new RegExp não pode lançar SyntaxError
          let regex: RegExp | null = null;
          assert.doesNotThrow(() => {
            regex = new RegExp(escaped, 'gi');
          }, `Falha ao compilar regex para a query: "${rawQuery}"`);

          // Invariante 2: se a query não for vazia, regex deve encontrar a própria query em si mesma
          if (rawQuery.length > 0 && regex) {
            assert.ok(
              regex.test(rawQuery),
              `Regex escapada deve encontrar a própria string: "${rawQuery}"`
            );
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * PBT-U3-02: Content Preservation & Identity Invariant
   * A aplicação do highlighting e posterior remoção dos marcadores <mark>
   * preserva 100% da integridade textual original de qualquer texto e query.
   */
  test('PBT-U3-02: Content Preservation & Identity Invariant (strip(highlight(text)) === text)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (text, query) => {
          const highlighted = highlightMatchesToString(text, query);
          const restored = stripHighlight(highlighted);

          assert.strictEqual(
            restored,
            text,
            'O texto restaurado após remoção das tags deve ser rigorosamente idêntico ao original'
          );
        }
      ),
      { numRuns: 250 }
    );
  });

  /**
   * PBT-U3-03: Match Counting Boundedness & Non-Negative Invariant
   * Para quaisquer texto e query, countMatches é sempre um inteiro >= 0.
   * Se o termo existe explicitamente no texto, a contagem é estritamente > 0.
   */
  test('PBT-U3-03: Match Counting Boundedness & Exact Occurrence Invariant', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        (targetTerm, prefix, suffix) => {
          // Se targetTerm for apenas whitespace, countMatches retorna 0
          if (!targetTerm.trim()) {
            const count = countMatches(`${prefix}${targetTerm}${suffix}`, targetTerm);
            assert.strictEqual(count, 0);
            return;
          }

          const combinedText = `${prefix}${targetTerm}${suffix}`;
          const count = countMatches(combinedText, targetTerm);

          assert.ok(Number.isInteger(count), 'Contagem deve ser número inteiro');
          assert.ok(count >= 1, `Termo presente deve resultar em contagem >= 1. Obtido: ${count}`);
        }
      ),
      { numRuns: 200 }
    );
  });
});
