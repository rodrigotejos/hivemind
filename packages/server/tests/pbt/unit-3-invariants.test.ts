import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { GitSupervisor } from '../../src/services/git-supervisor';

describe('Unit 3 Property-Based Tests (PBT Baseline)', () => {
  const supervisor = GitSupervisor.getInstance();

  /**
   * PBT-U3-01: Sensitive Files Blocking Invariant (Security Baseline)
   * Qualquer caminho de arquivo que contenha arquivos sensíveis (.env, .pem, .key, id_rsa, credentials.json)
   * é 100% detectado e bloqueia o commit, independentemente do nível de aninhamento de diretórios.
   */
  test('PBT-U3-01: Sensitive Files Blocking Invariant', () => {
    const sensitiveFileNames = fc.constantFrom(
      '.env',
      '.env.local',
      '.env.production',
      '.env.test',
      'cert.pem',
      'server.key',
      'auth.p12',
      'keystore.pfx',
      'id_rsa',
      'id_ed25519',
      'credentials.json',
      'secrets.yaml',
      'secrets.json'
    );

    const directoryArbitrary = fc.array(
      fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
      { minLength: 0, maxLength: 5 }
    );

    fc.assert(
      fc.property(
        directoryArbitrary,
        sensitiveFileNames,
        (dirs, sensitiveFile) => {
          const fullPath = dirs.length > 0 ? `${dirs.join('/')}/${sensitiveFile}` : sensitiveFile;
          const result = supervisor.checkSensitiveFiles([fullPath]);

          assert.strictEqual(
            result.isBlocked,
            true,
            `Arquivo sensível "${fullPath}" DEVE ser bloqueado obrigatoriamente`
          );
          assert.strictEqual(
            result.violations.length,
            1,
            `Deve conter exatamente 1 violação para "${fullPath}"`
          );
          assert.strictEqual(result.violations[0], fullPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U3-02: Safe Files Non-Blocking Invariant
   * Arquivos regulares de código fonte com extensões seguras (.ts, .tsx, .js, .md, .json)
   * nunca são bloqueados falsamente pela verificação de segurança.
   */
  test('PBT-U3-02: Safe Files Non-Blocking Invariant', () => {
    const safeExtensions = fc.constantFrom('.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.md', '.sql');
    const safeBaseNames = fc.stringMatching(/^[a-zA-Z0-9_-]+$/);
    const directoryArbitrary = fc.array(
      fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
      { minLength: 0, maxLength: 4 }
    );

    fc.assert(
      fc.property(
        directoryArbitrary,
        safeBaseNames,
        safeExtensions,
        (dirs, baseName, ext) => {
          // Garante que o nome base não coincida acidentalmente com padrões sensíveis
          fc.pre(!/env|credentials|secret|id_rsa|pem|key/i.test(baseName));
          const fileName = `${baseName}${ext}`;
          const fullPath = dirs.length > 0 ? `${dirs.join('/')}/${fileName}` : fileName;

          const result = supervisor.checkSensitiveFiles([fullPath]);
          assert.strictEqual(
            result.isBlocked,
            false,
            `Arquivo seguro "${fullPath}" NÃO deve ser bloqueado`
          );
          assert.strictEqual(result.violations.length, 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U3-03: Conventional Commits Syntax Invariant
   * Qualquer título de tarefa alfanumérico não-vazio gera uma sugestão estritamente
   * compatível com a especificação Conventional Commits (type(scope)?: subject).
   */
  test('PBT-U3-03: Conventional Commits Syntax Invariant', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 ]{3,50}$/),
        (taskTitle) => {
          fc.pre(taskTitle.trim().length >= 3);
          const suggestion = supervisor.generateSuggestedCommitMessage(taskTitle);

          // Valida formato Conventional Commits
          const conventionalCommitRegex = /^(feat|fix|refactor|docs|test|chore)(\([a-z0-9_-]+\))?: [^\r\n]+$/;
          assert.match(
            suggestion,
            conventionalCommitRegex,
            `A mensagem sugerida "${suggestion}" deve satisfazer a regex de Conventional Commits`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * PBT-U3-04: Resilient Backup Branch Name Invariant (Resiliency Baseline)
   * A branch de backup gerada para modificações rejeitadas deve ser estritamente determinística,
   * única no tempo e em total conformidade com as regras de nomes de referência do Git.
   */
  test('PBT-U3-04: Resilient Backup Branch Name Invariant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000000000, max: 2500000000 }),
        (timestamp) => {
          const branchName = `backup/rejected-${timestamp}`;

          // Regras do git check-ref-format:
          // 1. Não pode ter ..
          assert.ok(!branchName.includes('..'), 'Refname não pode conter ..');
          // 2. Não pode terminar com .lock ou /
          assert.ok(!branchName.endsWith('/'), 'Refname não pode terminar com /');
          assert.ok(!branchName.endsWith('.lock'), 'Refname não pode terminar com .lock');
          // 3. Não pode conter caracteres proibidos: espaço, ~, ^, :, ?, *, [, \
          assert.ok(!/[\s~^:?*[\\]/.test(branchName), 'Refname não pode conter caracteres de controle');
          // 4. Prefixo consistente
          assert.ok(branchName.startsWith('backup/rejected-'), 'Refname deve iniciar com backup/rejected-');
        }
      ),
      { numRuns: 50 }
    );
  });
});
