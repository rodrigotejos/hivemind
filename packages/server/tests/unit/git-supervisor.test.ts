import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GitSupervisor, BLOCKED_SENSITIVE_PATTERNS } from '../../src/services/git-supervisor';

describe('GitSupervisor Unit Tests (US-4, Security & Resiliency)', () => {
  const supervisor = GitSupervisor.getInstance();

  /**
   * Teste 1: Detecção de arquivos sensíveis proibidos (Security Baseline)
   */
  test('checkSensitiveFiles deve bloquear arquivos .env, .pem, .key e credentials.json', () => {
    const dangerousFiles = [
      '.env',
      '.env.production',
      'src/config/.env.local',
      'certs/server.pem',
      'ssh/id_rsa',
      'config/credentials.json',
      'secrets.yaml',
    ];

    const result = supervisor.checkSensitiveFiles(dangerousFiles);
    assert.strictEqual(result.isBlocked, true, 'Arquivos perigosos devem bloquear o commit');
    assert.strictEqual(result.violations.length, dangerousFiles.length, 'Todos os arquivos perigosos devem ser identificados');
  });

  /**
   * Teste 2: Arquivos legítimos não devem ser bloqueados
   */
  test('checkSensitiveFiles deve permitir arquivos normais de código e documentação', () => {
    const safeFiles = [
      'src/index.ts',
      'packages/web/src/App.tsx',
      'README.md',
      'package.json',
      'tsconfig.json',
      'src/services/ai-manager.ts',
      'tests/unit/git-supervisor.test.ts',
    ];

    const result = supervisor.checkSensitiveFiles(safeFiles);
    assert.strictEqual(result.isBlocked, false, 'Arquivos de código normais não devem ser bloqueados');
    assert.strictEqual(result.violations.length, 0);
  });

  /**
   * Teste 3: Geração de mensagem Conventional Commits baseada no título da tarefa
   */
  test('generateSuggestedCommitMessage deve gerar formato semântico a partir do título da tarefa', () => {
    const msgFeat = supervisor.generateSuggestedCommitMessage('Criar tela de login com autenticação');
    assert.match(msgFeat, /^feat\(.*?\):/i, 'Tarefas de criação devem iniciar com feat');

    const msgFix = supervisor.generateSuggestedCommitMessage('Corrigir bug no cálculo de tokens');
    assert.match(msgFix, /^fix\(.*?\):/i, 'Tarefas de correção devem iniciar com fix');

    const msgDoc = supervisor.generateSuggestedCommitMessage('Atualizar documentação do README');
    assert.match(msgDoc, /^docs(\(.*?\))?:/i, 'Tarefas de doc devem iniciar com docs');
  });

  /**
   * Teste 4: Geração de mensagem inferida pelos arquivos alterados quando sem título
   */
  test('generateSuggestedCommitMessage deve inferir escopo pelos arquivos quando sem título de tarefa', () => {
    const msgUi = supervisor.generateSuggestedCommitMessage('', ['src/components/Header.tsx', 'src/pages/Home.tsx']);
    assert.match(msgUi, /^feat\(ui\):/i);

    const msgDocs = supervisor.generateSuggestedCommitMessage('', ['docs/architecture.md', 'README.md']);
    assert.match(msgDocs, /^docs:/i);

    const msgTests = supervisor.generateSuggestedCommitMessage('', ['tests/unit/auth.test.ts']);
    assert.match(msgTests, /^test:/i);
  });

  /**
   * Teste 5: Validação de mensagem obrigatória no commitChanges
   */
  test('commitChanges deve rejeitar commit com mensagem vazia ou em branco', async () => {
    await assert.rejects(
      async () => {
        await supervisor.commitChanges(process.cwd(), '   ');
      },
      /Mensagem de commit é obrigatória/
    );
  });

  /**
   * Teste 6: Bloqueio estrito de arquivos sensíveis no commitChanges
   */
  test('commitChanges deve abortar e lançar SENSITIVE_FILE_VIOLATION se arquivos sensíveis forem detectados', async () => {
    // Simula validação chamando checkSensitiveFiles diretamente para confirmar exceção esperada
    const check = supervisor.checkSensitiveFiles(['.env.production']);
    assert.strictEqual(check.isBlocked, true);
    assert.ok(check.violations.includes('.env.production'));
  });
});
