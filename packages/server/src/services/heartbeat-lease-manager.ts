import { EventEmitter } from 'events';

export interface HeartbeatLease {
  taskId: string;
  pid?: number;
  startedAt: number;
  lastHeartbeat: number;
  leaseDurationMs: number;
  status: 'active' | 'expired' | 'terminated';
}

export class HeartbeatLeaseManager extends EventEmitter {
  private static instance: HeartbeatLeaseManager;
  private leases = new Map<string, HeartbeatLease>();
  private checkIntervalTimer?: NodeJS.Timeout;

  public static readonly DEFAULT_LEASE_DURATION_MS = 60_000; // 60 segundos
  public static readonly DEFAULT_CHECK_INTERVAL_MS = 5_000;   // Checagem a cada 5s
  public static readonly GRACE_PERIOD_MS = 5_000;            // 5s entre SIGTERM e SIGKILL

  private constructor() {
    super();
    this.startInspectionLoop();
  }

  public static getInstance(): HeartbeatLeaseManager {
    if (!HeartbeatLeaseManager.instance) {
      HeartbeatLeaseManager.instance = new HeartbeatLeaseManager();
    }
    return HeartbeatLeaseManager.instance;
  }

  /**
   * Registra uma nova tarefa com lease ativo.
   */
  public acquireLease(taskId: string, pid?: number, leaseDurationMs: number = HeartbeatLeaseManager.DEFAULT_LEASE_DURATION_MS): HeartbeatLease {
    const now = Date.now();
    const lease: HeartbeatLease = {
      taskId,
      pid,
      startedAt: now,
      lastHeartbeat: now,
      leaseDurationMs,
      status: 'active',
    };
    this.leases.set(taskId, lease);
    this.emit('lease_acquired', lease);
    return lease;
  }

  /**
   * Renova o batimento cardíaco da tarefa.
   */
  public renewLease(taskId: string): boolean {
    const lease = this.leases.get(taskId);
    if (!lease || lease.status !== 'active') {
      return false;
    }
    lease.lastHeartbeat = Date.now();
    this.emit('lease_renewed', lease);
    return true;
  }

  /**
   * Obtém a lease de uma tarefa.
   */
  public getLease(taskId: string): HeartbeatLease | undefined {
    return this.leases.get(taskId);
  }

  /**
   * Finaliza voluntariamente a lease (ex: tarefa concluída com sucesso).
   */
  public releaseLease(taskId: string): void {
    const lease = this.leases.get(taskId);
    if (lease) {
      lease.status = 'terminated';
      this.leases.delete(taskId);
      this.emit('lease_released', { taskId });
    }
  }

  /**
   * Checa todas as leases ativas e identifica aquelas que expiraram.
   */
  public checkExpiredLeases(): Array<{ taskId: string; pid?: number; idleMs: number }> {
    const now = Date.now();
    const expired: Array<{ taskId: string; pid?: number; idleMs: number }> = [];

    for (const [taskId, lease] of this.leases.entries()) {
      if (lease.status === 'active') {
        const idleMs = now - lease.lastHeartbeat;
        if (idleMs > lease.leaseDurationMs) {
          lease.status = 'expired';
          expired.push({ taskId, pid: lease.pid, idleMs });
          this.emit('lease_expired', { taskId, pid: lease.pid, idleMs });
        }
      }
    }

    return expired;
  }

  /**
   * Encerramento gracioso de subprocesso: SIGTERM -> aguarda 5s -> SIGKILL se ainda vivo.
   */
  public async terminateSubprocess(pid: number): Promise<boolean> {
    if (!pid || isNaN(pid) || pid <= 0) return false;

    try {
      // 1. Tenta envio gracioso de SIGTERM
      process.kill(pid, 'SIGTERM');
    } catch (e: any) {
      if (e?.code === 'ESRCH') {
        // Processo já não existe
        return true;
      }
      console.warn(`[HeartbeatLeaseManager] Falha ao enviar SIGTERM para PID ${pid}:`, e);
    }

    // 2. Aguarda grace period
    await new Promise(resolve => setTimeout(resolve, HeartbeatLeaseManager.GRACE_PERIOD_MS));

    // 3. Checa se ainda está rodando e força SIGKILL
    try {
      process.kill(pid, 0); // Testa se processo ainda responde
      process.kill(pid, 'SIGKILL');
      return true;
    } catch (e: any) {
      if (e?.code === 'ESRCH') {
        return true; // Encerrou com sucesso após SIGTERM
      }
      return false;
    }
  }

  private startInspectionLoop(): void {
    if (this.checkIntervalTimer) return;
    this.checkIntervalTimer = setInterval(async () => {
      const expired = this.checkExpiredLeases();
      for (const item of expired) {
        console.warn(`[HeartbeatLeaseManager] Lease expirado para task ${item.taskId} (idle ${item.idleMs}ms, PID ${item.pid}). Terminando...`);
        if (item.pid) {
          await this.terminateSubprocess(item.pid);
        }
        this.leases.delete(item.taskId);
      }
    }, HeartbeatLeaseManager.DEFAULT_CHECK_INTERVAL_MS);

    // Evita que o timer impeça o Node.js de encerrar se for o único evento ativo
    if (this.checkIntervalTimer.unref) {
      this.checkIntervalTimer.unref();
    }
  }

  public stopInspectionLoop(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = undefined;
    }
    this.leases.clear();
  }
}
