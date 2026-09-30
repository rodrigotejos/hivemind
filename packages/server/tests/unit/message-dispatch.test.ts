import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as queries from '../../src/db/queries';
import { supervisorNode } from '../../src/services/langgraph/nodes';
import { AgentGraphStateType } from '../../src/services/langgraph/state';

describe('Message Dispatch & Fast Convergence (Chat Responsiveness)', () => {
  const testProjectId = `test_proj_${Date.now()}`;

  test('Deve persistir mensagem com prioridade default e status pending imediatamente', () => {
    // Garante que o projeto existe no banco
    const proj = queries.createProject('Test Project', 'Projeto de Teste', '', 'E:\\code\\test_proj') as any;
    const testProjId = proj.id;

    const msg = queries.createMessage({
      projectId: testProjId,
      fromAgentId: 'rodrigo',
      content: 'Verifique a arquitetura do projeto e sugira melhorias',
      type: 'statement',
      priority: 'normal',
    });

    assert.ok(msg);
    assert.strictEqual(msg.from_agent_id, 'rodrigo');
    assert.strictEqual(msg.priority, 'normal');
    assert.strictEqual(msg.content, 'Verifique a arquitetura do projeto e sugira melhorias');
  });

  test('SupervisorNode deve rotear para beta_backend no primeiro turno para análise geral', async () => {
    const initialState: AgentGraphStateType = {
      projectId: testProjectId,
      taskId: 'task_1',
      goal: 'Verifique a arquitetura do projeto e me diga o que fazer para melhorar',
      messages: [],
      turnCount: 0,
      maxTurns: 5,
      isConverged: false,
      status: 'running',
      nextStep: '',
    };

    const decision = await supervisorNode(initialState);
    assert.strictEqual(decision.nextStep, 'beta_backend');
    assert.strictEqual(decision.currentAgent, 'beta-backend');
    assert.strictEqual(decision.status, 'running');
  });

  test('SupervisorNode deve convergir imediatamente após 1 turno para tarefas diretas de chat', async () => {
    const stateAfterWorker: AgentGraphStateType = {
      projectId: testProjectId,
      taskId: 'task_1',
      goal: 'Verifique a arquitetura do projeto e me diga o que fazer para melhorar',
      messages: [
        {
          id: 'msg_1',
          role: 'assistant',
          agentId: 'beta-backend',
          content: 'A análise da arquitetura revelou estrutura Express padrão...',
          timestamp: new Date().toISOString(),
        }
      ],
      turnCount: 1,
      maxTurns: 5,
      isConverged: false,
      status: 'running',
      nextStep: 'supervisor',
    };

    const decision = await supervisorNode(stateAfterWorker);
    // Para tarefas unitárias de chat, após a resposta do especialista deve convergir sem loop desnecessário
    assert.strictEqual(decision.nextStep, 'convergence');
    assert.strictEqual(decision.isConverged, true);
    assert.strictEqual(decision.status, 'completed');
  });

  test('SupervisorNode deve permitir pipeline multi-agente quando o objetivo é adversarial', async () => {
    const stateAdversarial: AgentGraphStateType = {
      projectId: testProjectId,
      taskId: 'task_sec',
      goal: 'Auditoria de Segurança Adversarial Red Team vs Blue Team completa',
      messages: [
        {
          id: 'msg_delta',
          role: 'assistant',
          agentId: 'delta-security',
          content: 'Relatório Red Team: Mapeadas vulnerabilidades OWASP...',
          timestamp: new Date().toISOString(),
        }
      ],
      turnCount: 1,
      maxTurns: 5,
      isConverged: false,
      status: 'running',
      nextStep: 'supervisor',
    };

    const decision = await supervisorNode(stateAdversarial);
    // Para segurança adversarial, Blue Team (beta_backend) deve atuar após o Red Team
    assert.strictEqual(decision.nextStep, 'beta_backend');
  });
});
