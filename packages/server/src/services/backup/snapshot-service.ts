import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as queries from '../../db/queries';
import db from '../../db/connection';
import { SnapshotMetadata } from '@ai-dlc/sdk';

export interface ProjectSnapshotPayload {
  version: string;
  projectId: string;
  exportedAt: string;
  project: any;
  agents: any[];
  messages: any[];
  decisions: any[];
  notifications: any[];
  sha256?: string;
}

export class CloudSnapshotService {
  private static instance: CloudSnapshotService;
  private snapshots = new Map<string, SnapshotMetadata>();
  private snapshotPayloads = new Map<string, ProjectSnapshotPayload>();
  private backupDir: string;

  private constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(this.backupDir)) {
      try { fs.mkdirSync(this.backupDir, { recursive: true }); } catch (e) {}
    }
  }

  public static getInstance(): CloudSnapshotService {
    if (!CloudSnapshotService.instance) {
      CloudSnapshotService.instance = new CloudSnapshotService();
    }
    return CloudSnapshotService.instance;
  }

  public createSnapshot(projectId: string): SnapshotMetadata {
    const project = queries.getProject(projectId);
    const messages = queries.getProjectMessages(projectId);
    const decisions = queries.getProjectDecisions(projectId);
    const notifications = queries.getProjectNotifications(projectId);
    const agents = queries.getProjectAgents(projectId);

    const payload: ProjectSnapshotPayload = {
      version: '1.0.0',
      projectId,
      exportedAt: new Date().toISOString(),
      project,
      agents,
      messages,
      decisions,
      notifications,
    };

    const jsonStr = JSON.stringify(payload);
    const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex');
    payload.sha256 = sha256;

    const snapshotId = `snap_${Date.now()}_${projectId.substring(0, 8)}`;
    const byteSize = Buffer.byteLength(jsonStr, 'utf-8');

    // Salva arquivo localmente
    const filePath = path.join(this.backupDir, `${snapshotId}.json`);
    try {
      fs.writeFileSync(filePath, jsonStr, 'utf-8');
    } catch (err) {
      console.warn('Falha ao gravar arquivo de snapshot em disco:', err);
    }

    const metadata: SnapshotMetadata = {
      snapshotId,
      projectId,
      sha256,
      byteSize,
      createdAt: payload.exportedAt,
      s3Uri: `s3://hivemind-backups/${projectId}/${snapshotId}.json`,
    };

    this.snapshots.set(snapshotId, metadata);
    this.snapshotPayloads.set(snapshotId, payload);

    return metadata;
  }

  public restoreSnapshot(snapshotId: string): { success: boolean; restoredRecords: { messages: number; decisions: number } } {
    let payload = this.snapshotPayloads.get(snapshotId);

    // Se não estiver em memória, tenta ler do disco
    if (!payload) {
      const filePath = path.join(this.backupDir, `${snapshotId}.json`);
      if (fs.existsSync(filePath)) {
        payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }

    if (!payload) {
      throw new Error(`Snapshot ${snapshotId} não encontrado.`);
    }

    try {
      db.exec('BEGIN');

      // 1. Restaura/Atualiza projeto
      if (payload.project) {
        db.prepare(`
          INSERT OR REPLACE INTO projects (id, name, path, shared_context, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          payload.project.id,
          payload.project.name,
          payload.project.path,
          payload.project.shared_context,
          payload.project.created_at
        );
      }

      // 2. Restaura mensagens
      for (const msg of payload.messages || []) {
        db.prepare(`
          INSERT OR REPLACE INTO messages (id, project_id, from_agent_id, to_agent_id, thread_id, type, priority, content, metadata, status, waiting_response, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          msg.id,
          msg.project_id,
          msg.from_agent_id,
          msg.to_agent_id || null,
          msg.thread_id || null,
          msg.type,
          msg.priority || 'normal',
          msg.content,
          msg.metadata || null,
          msg.status || 'active',
          msg.waiting_response ? 1 : 0,
          msg.created_at
        );
      }

      // 3. Restaura decisões
      for (const dec of payload.decisions || []) {
        db.prepare(`
          INSERT OR REPLACE INTO decisions (id, project_id, title, content, made_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          dec.id,
          dec.project_id,
          dec.title,
          dec.content,
          dec.made_by,
          dec.created_at
        );
      }

      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }

    return {
      success: true,
      restoredRecords: {
        messages: (payload.messages || []).length,
        decisions: (payload.decisions || []).length,
      },
    };
  }

  public listSnapshots(projectId: string): SnapshotMetadata[] {
    const list: SnapshotMetadata[] = [];
    for (const snap of this.snapshots.values()) {
      if (snap.projectId === projectId) {
        list.push(snap);
      }
    }
    return list;
  }
}
