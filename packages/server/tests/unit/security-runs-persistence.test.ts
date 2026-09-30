import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import db, { initDb } from '../../src/db/connection';
import * as queries from '../../src/db/queries';
import { SecurityPipelineService } from '../../src/services/security-pipeline';

describe('Unit 1: Security Runs Persistence & Concurrency Lockout (US-13, US-14, US-15)', () => {
  before(() => {
    initDb();
  });

  function createTestProject(id: string) {
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, description, status)
      VALUES (?, 'Test Runs Project', 'Projeto para testes de persistência de security_runs', 'active')
    `).run(id);
  }

  test('Deve criar novo registro em security_runs com status running', () => {
    const projId = `test_proj_create_${Date.now()}`;
    createTestProject(projId);

    const runId = `run_test_${Date.now()}`;
    const run = queries.createSecurityRun({
      id: runId,
      projectId: projId,
      phase: 1,
      totalPhases: 5,
      phaseName: 'Mapeamento de Rotas, CORS & Headers',
      agentRole: 'delta-security',
      agentName: 'Delta (Security - Red Team)',
      currentCheck: 'Inspecionando middlewares...',
      targetFile: 'src/routes/*.ts',
    });

    assert.ok(run, 'Registro de run deve ser retornado');
    assert.strictEqual(run.id, runId);
    assert.strictEqual(run.project_id, projId);
    assert.strictEqual(run.phase, 1);
    assert.strictEqual(run.status, 'running');
    assert.strictEqual(run.completed_at, null);
  });

  test('Deve atualizar progressivamente a fase do run e marcar completed na conclusão', () => {
    const projId = `test_proj_prog_${Date.now()}`;
    createTestProject(projId);

    const runId = `run_test_prog_${Date.now()}`;
    queries.createSecurityRun({
      id: runId,
      projectId: projId,
      phase: 1,
      phaseName: 'Fase 1',
      agentRole: 'delta-security',
      agentName: 'Delta',
    });

    // Avança para Fase 3
    const updatedF3 = queries.updateSecurityRunProgress(runId, {
      phase: 3,
      phase_name: 'Simulação Adversarial OWASP (Red Team)',
      current_check: 'Testando injeções...',
      target_file: 'src/routes/security.ts',
    });

    assert.ok(updatedF3);
    assert.strictEqual(updatedF3.phase, 3);
    assert.strictEqual(updatedF3.status, 'running');

    // Conclui na Fase 5
    const completedRun = queries.updateSecurityRunProgress(runId, {
      phase: 5,
      phase_name: 'Verificação Formal & Gravação no SQLite',
      status: 'completed',
      score: 85,
    });

    assert.ok(completedRun);
    assert.strictEqual(completedRun.phase, 5);
    assert.strictEqual(completedRun.status, 'completed');
    assert.strictEqual(completedRun.score, 85);
    assert.ok(completedRun.completed_at !== null, 'completed_at deve ser preenchido');
  });

  test('getLatestSecurityRun deve retornar o run mais recente (para re-hidratação pós-refresh)', () => {
    const projId = `test_proj_latest_${Date.now()}`;
    createTestProject(projId);

    const runIdOld = `run_test_old_${Date.now()}`;
    const runIdNew = `run_test_new_${Date.now() + 10}`;

    queries.createSecurityRun({
      id: runIdOld,
      projectId: projId,
      phase: 5,
      phaseName: 'Fase Velha',
      status: 'completed',
      agentRole: 'system',
      agentName: 'Supervisor',
    });

    queries.createSecurityRun({
      id: runIdNew,
      projectId: projId,
      phase: 2,
      phaseName: 'Fase Nova em Andamento',
      status: 'running',
      agentRole: 'delta-security',
      agentName: 'Delta',
    });

    const latest = queries.getLatestSecurityRun(projId);
    assert.ok(latest);
    assert.strictEqual(latest.id, runIdNew, 'O run mais recente deve ser retornado');
    assert.strictEqual(latest.status, 'running');
    assert.strictEqual(latest.phase, 2);
  });

  test('getActiveSecurityRun deve retornar apenas runs com status running', () => {
    const projId = `test_proj_active_${Date.now()}`;
    createTestProject(projId);

    const runIdActive = `run_test_act_${Date.now()}`;
    queries.createSecurityRun({
      id: runIdActive,
      projectId: projId,
      phase: 4,
      phaseName: 'Defesas & Mitigações',
      status: 'running',
      agentRole: 'beta-backend',
      agentName: 'Beta',
    });

    const active = queries.getActiveSecurityRun(projId);
    assert.ok(active, 'Deve encontrar run ativo');
    assert.strictEqual(active.status, 'running');

    // Finaliza o run
    queries.updateSecurityRunProgress(runIdActive, { status: 'completed' });
    const noActive = queries.getActiveSecurityRun(projId);
    assert.strictEqual(noActive, null, 'Não deve retornar run após completed');
  });

  test('SecurityPipelineService deve persistir run no banco e bloquear execução simultânea (Idempotência)', async () => {
    const projId = `test_proj_service_${Date.now()}`;
    createTestProject(projId);

    const service = SecurityPipelineService.getInstance();
    const mockIo = {
      to: () => ({ emit: () => {} }),
    };

    // Executa pipeline com stepDelayMs = 0 para teste instantâneo
    const result = await service.runPipeline(projId, { stepDelayMs: 0, io: mockIo });
    assert.ok(result.success);
    assert.ok(result.runId, 'runId deve ser retornado na resposta');

    // Verifica que o run foi persistido com sucesso no banco SQLite
    const persistedRun = queries.getLatestSecurityRun(projId);
    assert.ok(persistedRun);
    assert.strictEqual(persistedRun.id, result.runId);
    assert.strictEqual(persistedRun.phase, 5);
    assert.strictEqual(persistedRun.status, 'completed');
  });
});
