import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';
import { HeartbeatLeaseManager } from '../../src/services/heartbeat-lease-manager';

describe('HeartbeatLeaseManager (US-8, Resiliency Baseline)', () => {
  const manager = HeartbeatLeaseManager.getInstance();

  afterEach(() => {
    manager.stopInspectionLoop();
  });

  test('deve adquirir lease ativo para tarefa', () => {
    const lease = manager.acquireLease('task-001', 12345, 30_000);
    assert.strictEqual(lease.taskId, 'task-001');
    assert.strictEqual(lease.pid, 12345);
    assert.strictEqual(lease.status, 'active');
  });

  test('deve renovar timestamp do lease ao receber heartbeat', async () => {
    const lease = manager.acquireLease('task-002', 12346, 30_000);
    const initialHeartbeat = lease.lastHeartbeat;

    await new Promise(r => setTimeout(r, 20));
    const renewed = manager.renewLease('task-002');
    assert.strictEqual(renewed, true);

    const updated = manager.getLease('task-002');
    assert.ok(updated!.lastHeartbeat > initialHeartbeat);
  });

  test('deve detectar leases expirados quando ociosidade exceder timeout', async () => {
    // Registra lease com duração curtíssima de 25ms para teste rápido
    manager.acquireLease('task-short-lived', 9999, 25);
    
    await new Promise(r => setTimeout(r, 40));
    const expired = manager.checkExpiredLeases();

    assert.ok(expired.some(e => e.taskId === 'task-short-lived'));
  });

  test('deve liberar lease quando tarefa finalizar', () => {
    manager.acquireLease('task-to-finish', 1111);
    manager.releaseLease('task-to-finish');
    assert.strictEqual(manager.getLease('task-to-finish'), undefined);
  });
});
