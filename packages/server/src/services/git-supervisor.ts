import { execFile } from 'child_process';
import util from 'util';
import path from 'path';

const execFilePromise = util.promisify(execFile);

export interface ChangedFileSummary {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked';
  additions: number;
  deletions: number;
}

export interface CommitExecutionResult {
  success: boolean;
  action: 'committed' | 'rejected_and_backed_up';
  commitHash?: string;
  branch: string;
  backupBranch?: string;
  filesCount: number;
  output: string;
  error?: string;
  timestamp: string;
}

export interface GitDiffAnalysis {
  hasChanges: boolean;
  filesChanged: ChangedFileSummary[];
  diff: string;
  totalAdditions: number;
  totalDeletions: number;
  suggestedMessage: string;
  sensitiveFilesDetected: string[];
  isBlocked: boolean;
}

/**
 * Padrões de arquivos restritos (Security Baseline).
 * Qualquer arquivo que corresponda a estes padrões bloqueia o commit imediatamente.
 */
export const BLOCKED_SENSITIVE_PATTERNS: RegExp[] = [
  /(^|[/\\])\.env(\..+)?$/i,
  /\.(pem|key|p12|pfx|pkcs12)$/i,
  /(^|[/\\])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|[/\\])credentials\.json$/i,
  /(^|[/\\])secrets?\.(json|ya?ml)$/i,
  /(^|[/\\])\.aws[/\\]credentials$/i,
];

export class GitSupervisor {
  private static instance: GitSupervisor;

  private constructor() {}

  public static getInstance(): GitSupervisor {
    if (!GitSupervisor.instance) {
      GitSupervisor.instance = new GitSupervisor();
    }
    return GitSupervisor.instance;
  }

  /**
   * Verifica se a lista de arquivos contém algum arquivo sensível proibido.
   */
  public checkSensitiveFiles(files: string[]): { isBlocked: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const file of files) {
      const normalizedPath = file.replace(/\\/g, '/');
      const baseName = path.basename(normalizedPath);

      for (const pattern of BLOCKED_SENSITIVE_PATTERNS) {
        if (pattern.test(normalizedPath) || pattern.test(baseName)) {
          violations.push(file);
          break;
        }
      }
    }

    return {
      isBlocked: violations.length > 0,
      violations,
    };
  }

  /**
   * Gera uma sugestão semântica de mensagem de commit seguindo o padrão Conventional Commits.
   */
  public generateSuggestedCommitMessage(taskTitle?: string, filesChanged: string[] = []): string {
    // 1. Se houver título de tarefa, usar como base
    if (taskTitle && taskTitle.trim()) {
      const cleanTitle = taskTitle.trim().replace(/[.:;]+$/, '');
      const lower = cleanTitle.toLowerCase();

      let type = 'feat';
      if (/fix|bug|corrig|corrige|erro|falha/i.test(lower)) type = 'fix';
      else if (/refactor|melhora|clean|cleanup|otimiza/i.test(lower)) type = 'refactor';
      else if (/doc|readme|document/i.test(lower)) type = 'docs';
      else if (/test|teste|pbt/i.test(lower)) type = 'test';
      else if (/infra|docker|deploy|setup|config/i.test(lower)) type = 'chore';

      // Identificar escopo
      let scope = '';
      if (/ui|view|page|component|modal|cockpit|front/i.test(lower)) scope = 'ui';
      else if (/auth|login|token|permission/i.test(lower)) scope = 'auth';
      else if (/git|commit|diff/i.test(lower)) scope = 'git';
      else if (/api|server|back|route|service/i.test(lower)) scope = 'api';
      else if (/ai|llm|stream|gemini/i.test(lower)) scope = 'ai';

      const scopePart = scope ? `(${scope})` : '';
      return `${type}${scopePart}: ${cleanTitle.toLowerCase()}`;
    }

    // 2. Se não houver título, inferir pelos arquivos
    if (filesChanged.length === 0) {
      return 'chore: update project files';
    }

    const hasTests = filesChanged.some(f => /test|spec/i.test(f));
    const hasDocs = filesChanged.every(f => /\.md$/i.test(f));
    const hasUi = filesChanged.some(f => /\.(tsx|jsx|css|html)$/i.test(f) || /components|pages/i.test(f));
    const hasBackend = filesChanged.some(f => /server|service|routes|controller/i.test(f));

    if (hasDocs) return 'docs: update project documentation';
    if (hasTests && !hasBackend && !hasUi) return 'test: add and update test suites';
    if (hasUi && !hasBackend) return 'feat(ui): update user interface components';
    if (hasBackend && !hasUi) return 'feat(api): update backend services and endpoints';

    return 'feat(core): update application components';
  }

  /**
   * Obtém o diff completo e status dos arquivos no repositório.
   */
  public async getDiff(workingDir: string, taskTitle?: string): Promise<GitDiffAnalysis> {
    let statusOutput = '';
    try {
      const { stdout } = await execFilePromise('git', ['status', '--porcelain'], { cwd: workingDir });
      statusOutput = stdout.trim();
    } catch {
      statusOutput = '';
    }

    let diffOutput = '';
    try {
      // Intent-to-add para que arquivos novos apareçam no git diff HEAD
      await execFilePromise('git', ['add', '-N', '.'], { cwd: workingDir }).catch(() => {});
      const { stdout } = await execFilePromise('git', ['diff', 'HEAD'], { cwd: workingDir });
      diffOutput = stdout.trim();
    } catch {
      try {
        const { stdout } = await execFilePromise('git', ['diff'], { cwd: workingDir });
        diffOutput = stdout.trim();
      } catch {
        diffOutput = '';
      }
    }

    const lines = statusOutput ? statusOutput.split('\n').filter(Boolean) : [];
    const filesChanged: ChangedFileSummary[] = [];

    for (const line of lines) {
      const statusChar = line.slice(0, 2).trim();
      const filePath = line.slice(3).trim();

      let status: ChangedFileSummary['status'] = 'modified';
      if (statusChar.includes('A') || statusChar.includes('?')) status = 'added';
      else if (statusChar.includes('D')) status = 'deleted';
      else if (statusChar.includes('M')) status = 'modified';

      // Contagem aproximada de adições/deleções no diff deste arquivo
      let additions = 0;
      let deletions = 0;
      const fileEscaped = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileDiffRegex = new RegExp(`diff --git a/.*?${fileEscaped}[\\s\\S]*?(?=(diff --git|$))`, 'g');
      const match = fileDiffRegex.exec(diffOutput);
      if (match) {
        const chunk = match[0];
        const diffLines = chunk.split('\n');
        for (const dl of diffLines) {
          if (dl.startsWith('+') && !dl.startsWith('+++')) additions++;
          else if (dl.startsWith('-') && !dl.startsWith('---')) deletions++;
        }
      }

      filesChanged.push({
        path: filePath,
        status,
        additions,
        deletions,
      });
    }

    let totalAdditions = 0;
    let totalDeletions = 0;
    for (const dl of diffOutput.split('\n')) {
      if (dl.startsWith('+') && !dl.startsWith('+++')) totalAdditions++;
      else if (dl.startsWith('-') && !dl.startsWith('---')) totalDeletions++;
    }

    const rawPaths = filesChanged.map(f => f.path);
    const securityCheck = this.checkSensitiveFiles(rawPaths);
    const suggestedMessage = this.generateSuggestedCommitMessage(taskTitle, rawPaths);

    return {
      hasChanges: filesChanged.length > 0 || diffOutput.length > 0,
      filesChanged,
      diff: diffOutput || (statusOutput ? `Arquivos pendentes de commit:\n${statusOutput}` : 'Nenhuma alteração detectada no repositório.'),
      totalAdditions,
      totalDeletions,
      suggestedMessage,
      sensitiveFilesDetected: securityCheck.violations,
      isBlocked: securityCheck.isBlocked,
    };
  }

  /**
   * Executa commit seguro usando execFile com argumentos atômicos (Security Baseline).
   */
  public async commitChanges(
    workingDir: string,
    message: string,
    operator: string = 'human'
  ): Promise<CommitExecutionResult> {
    if (!message || !message.trim()) {
      throw new Error('Mensagem de commit é obrigatória.');
    }

    const cleanMessage = message.trim();

    // 1. Verificar se há alterações
    const { stdout: statusOut } = await execFilePromise('git', ['status', '--porcelain'], { cwd: workingDir });
    const rawFiles = statusOut
      .trim()
      .split('\n')
      .map(l => l.slice(3).trim())
      .filter(Boolean);

    if (rawFiles.length === 0) {
      throw new Error('Nenhuma alteração pendente para comitar.');
    }

    // 2. Bloqueio estrito de arquivos sensíveis (Security Baseline)
    const securityCheck = this.checkSensitiveFiles(rawFiles);
    if (securityCheck.isBlocked) {
      const violationsStr = securityCheck.violations.join(', ');
      throw new Error(`SENSITIVE_FILE_VIOLATION: Arquivos sensíveis detectados (${violationsStr}). Commit bloqueado por segurança.`);
    }

    // 3. Obter branch atual
    let branch = 'main';
    try {
      const { stdout: branchOut } = await execFilePromise('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workingDir });
      branch = branchOut.trim() || 'main';
    } catch {}

    // 4. Executar git add .
    await execFilePromise('git', ['add', '.'], { cwd: workingDir });

    // 5. Executar git commit de forma atômica (sem shell injection)
    const { stdout: commitOut } = await execFilePromise('git', ['commit', '-m', cleanMessage], { cwd: workingDir });

    // 6. Obter hash do commit
    let commitHash = '';
    try {
      const { stdout: hashOut } = await execFilePromise('git', ['rev-parse', '--short', 'HEAD'], { cwd: workingDir });
      commitHash = hashOut.trim();
    } catch {
      commitHash = 'UNKNOWN';
    }

    return {
      success: true,
      action: 'committed',
      commitHash,
      branch,
      filesCount: rawFiles.length,
      output: commitOut.trim(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Rejeita as alterações preservando o trabalho em uma branch de backup temporária (Resiliency Baseline).
   */
  public async rejectChanges(
    workingDir: string,
    reason: string = 'Rejeitado pelo operador',
    operator: string = 'human'
  ): Promise<CommitExecutionResult> {
    // 1. Obter branch atual
    let originalBranch = 'main';
    try {
      const { stdout: branchOut } = await execFilePromise('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workingDir });
      originalBranch = branchOut.trim() || 'main';
    } catch {}

    // 2. Verificar se há alterações para salvar em backup
    const { stdout: statusOut } = await execFilePromise('git', ['status', '--porcelain'], { cwd: workingDir });
    const rawFiles = statusOut
      .trim()
      .split('\n')
      .map(l => l.slice(3).trim())
      .filter(Boolean);

    if (rawFiles.length === 0) {
      return {
        success: true,
        action: 'rejected_and_backed_up',
        branch: originalBranch,
        filesCount: 0,
        output: 'Nenhuma alteração a rejeitar.',
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Criar branch de backup resiliente: backup/rejected-<timestamp>
    const timestamp = Date.now();
    const backupBranch = `backup/rejected-${timestamp}`;

    // Indexar alterações atuais
    await execFilePromise('git', ['add', '.'], { cwd: workingDir });

    // Criar e trocar para a branch de backup
    await execFilePromise('git', ['checkout', '-b', backupBranch], { cwd: workingDir });

    // Comitar na branch de backup
    const backupMsg = `chore(backup): rejected changes by ${operator} - ${reason}`;
    await execFilePromise('git', ['commit', '-m', backupMsg], { cwd: workingDir });

    // 4. Retornar à branch original
    await execFilePromise('git', ['checkout', originalBranch], { cwd: workingDir });

    // 5. Limpar working tree de volta ao estado limpo de HEAD
    await execFilePromise('git', ['reset', '--hard', 'HEAD'], { cwd: workingDir });
    await execFilePromise('git', ['clean', '-fd'], { cwd: workingDir });

    return {
      success: true,
      action: 'rejected_and_backed_up',
      branch: originalBranch,
      backupBranch,
      filesCount: rawFiles.length,
      output: `Modificações revertidas. Backup preservado na branch ${backupBranch}.`,
      timestamp: new Date().toISOString(),
    };
  }
}
