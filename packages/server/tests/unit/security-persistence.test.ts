import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import db, { initDb } from '../../src/db/connection';
import * as queries from '../../src/db/queries';
import { SecurityPipelineService } from '../../src/services/security-pipeline';

describe('Unit 1: Security Score Persistence & 5-Phase Pipeline (US-9, US-11)', () => {
  const testProjectId = `test_proj_${Date.now()}`;

  before(() => {
    initDb();
    queries.createProject('Test Security Project', 'Unit 1 Testing', undefined, undefined);
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, description, status)
      VALUES (?, 'Test Security Project', 'Testing security score persistence', 'active')
    `).run(testProjectId);
  });

  after(() => {
    try {
      db.prepare('DELETE FROM security_findings WHERE project_id = ?').run(testProjectId);
      db.prepare('DELETE FROM projects WHERE id = ?').run(testProjectId);
    } catch (e) {}
  });

  test('Deve atualizar e persistir security_score e security_rating na tabela projects', () => {
    queries.updateProjectSecurityScore(testProjectId, 82, 'B');

    const project = queries.getProject(testProjectId) as any;
    assert.ok(project, 'Projeto deve existir');
    assert.strictEqual(project.security_score, 82);
    assert.strictEqual(project.security_rating, 'B');
    assert.ok(project.last_security_audit_at, 'last_security_audit_at deve estar preenchido');
  });

  test('getProjectSecuritySummary deve sincronizar score e rating com a tabela projects', () => {
    // Insere findings de teste
    queries.createSecurityFinding({
      projectId: testProjectId,
      title: 'SQL Injection Test',
      category: 'injection',
      severity: 'critical',
      status: 'open',
    });

    const summary = queries.getProjectSecuritySummary(testProjectId);
    assert.strictEqual(summary.score, 75); // 100 - 25 = 75
    assert.strictEqual(summary.rating, 'B');

    // Confere se na tabela projects foi gravado de imediato
    const project = queries.getProject(testProjectId) as any;
    assert.strictEqual(project.security_score, 75);
    assert.strictEqual(project.security_rating, 'B');
  });

  test('SecurityPipelineService deve bloquear execuções concorrentes para o mesmo projectId (Idempotência BR-01)', async () => {
    const pipeline = SecurityPipelineService.getInstance();
    
    // Inicia um pipeline assíncrono com delay
    const firstPromise = pipeline.runPipeline(testProjectId, { stepDelayMs: 50 });
    
    // Segunda chamada concorrente deve retornar aviso de já em andamento
    const concurrentResult = await pipeline.runPipeline(testProjectId, { stepDelayMs: 50 });
    assert.strictEqual(concurrentResult.running, true);
    assert.ok(concurrentResult.message.includes('em andamento'));

    await firstPromise;
    assert.strictEqual(pipeline.isScanRunning(testProjectId), false);
  });

  test('SecurityPipelineService deve executar as 5 fases e persistir score final no banco', async () => {
    const pipeline = SecurityPipelineService.getInstance();
    const result = await pipeline.runPipeline(testProjectId, { stepDelayMs: 10 });

    assert.strictEqual(result.success, true);
    assert.ok(result.summary);
    assert.strictEqual(typeof result.summary.score, 'number');

    const updatedProject = queries.getProject(testProjectId) as any;
    assert.strictEqual(updatedProject.security_score, result.summary.score);
    assert.strictEqual(updatedProject.security_rating, result.summary.rating);
  });
});
