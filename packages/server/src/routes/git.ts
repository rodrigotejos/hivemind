import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import util from 'util';
import * as queries from '../db/queries';

const execPromise = util.promisify(exec);
export const gitRouter = Router();

// GET /api/projects/:projectId/git/diff - Retorna git diff e arquivos alterados
gitRouter.get('/projects/:projectId/git/diff', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();

    // 1. Obtém status dos arquivos alterados
    let statusOutput = '';
    try {
      const { stdout } = await execPromise('git status --porcelain', { cwd: workingDir });
      statusOutput = stdout.trim();
    } catch (e) {}

    // 2. Obtém o diff completo das modificações
    let diffOutput = '';
    try {
      const { stdout } = await execPromise('git diff HEAD', { cwd: workingDir });
      diffOutput = stdout.trim();
    } catch (e) {
      try {
        const { stdout } = await execPromise('git diff', { cwd: workingDir });
        diffOutput = stdout.trim();
      } catch (err2) {}
    }

    const filesChanged = statusOutput
      ? statusOutput.split('\n').map(line => line.trim().slice(3)).filter(Boolean)
      : [];

    res.json({
      success: true,
      hasChanges: filesChanged.length > 0 || diffOutput.length > 0,
      filesChanged,
      diff: diffOutput || (statusOutput ? `Arquivos pendentes de commit:\n${statusOutput}` : 'Nenhuma alteração detectada no repositório.'),
      status: statusOutput,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/git/commit - Executa git add e git commit automático
gitRouter.post('/projects/:projectId/git/commit', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    res.status(400).json({ success: false, error: 'Mensagem de commit é obrigatória.' });
    return;
  }

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();
    const cleanMessage = message.trim().replace(/"/g, '\\"');

    // 1. git add .
    await execPromise('git add .', { cwd: workingDir });

    // 2. git commit -m "..."
    const { stdout } = await execPromise(`git commit -m "${cleanMessage}"`, { cwd: workingDir });

    // 3. Obtém o hash do commit criado
    let commitHash = '';
    try {
      const { stdout: hashOut } = await execPromise('git rev-parse --short HEAD', { cwd: workingDir });
      commitHash = hashOut.trim();
    } catch (e) {}

    res.json({
      success: true,
      commitHash: commitHash || 'OK',
      output: stdout.trim(),
      message: cleanMessage,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Falha ao executar commit no repositório.' });
  }
});
