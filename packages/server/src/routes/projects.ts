import { Router } from 'express';
import * as queries from '../db/queries';
import * as aiManager from '../services/ai-manager';

const router = Router();

// GET /api/projects
router.get('/', (req, res) => {
  const projects = queries.getProjects();
  res.json(projects);
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name, description, path } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const project = queries.createProject(name, description, undefined, path);
  
  if (project) {
    const projectId = (project as any).id as string;

    // Vincula agentes padrão ao projeto
    const defaultAgents = [
      { id: 'rodrigo', role: 'manager' },
      { id: 'alpha-frontend', role: 'worker' },
      { id: 'beta-backend', role: 'worker' },
      { id: 'gamma-qa', role: 'reviewer' },
      { id: 'delta-security', role: 'reviewer' },
      { id: 'epsilon-infra', role: 'worker' },
    ];

    for (const ag of defaultAgents) {
      try {
        queries.addAgentToProject(projectId, ag.id, ag.role);
      } catch (e) {}
    }

    // Cria sessão inicial de tarefa
    try {
      queries.createTaskSession(projectId, 'Canal Geral', 'Sessão principal de integração e planejamento');
    } catch (e) {}

    // Background task: generate context
    aiManager.generateInitialContext(name, description).then(context => {
      queries.updateProjectContext(projectId, context);
    }).catch(e => console.error('Failed to generate initial context', e));
  }

  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const project = queries.getProject(id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

// GET /api/projects/:id/agents
router.get('/:id/agents', (req, res) => {
  const { id } = req.params;
  const agents = queries.getProjectAgents(id);
  res.json(agents);
});

// POST /api/projects/:id/agents
router.post('/:id/agents', (req, res) => {
  const { id } = req.params;
  const { agentId, role } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const rel = queries.addAgentToProject(id, agentId, role);
  res.status(201).json(rel);
});

// POST /api/projects/:id/context/analyze
router.post('/:id/context/analyze', async (req, res) => {
  const { id } = req.params;
  const { analysisData } = req.body;
  if (!analysisData) return res.status(400).json({ error: 'analysisData is required' });

  const project = queries.getProject(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    const newContext = await aiManager.expandContextWithRealData((project as any).shared_context || '', analysisData);
    queries.updateProjectContext(id, newContext);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`project_${id}`).emit('project_updated', { project: queries.getProject(id) });
    }

    res.json({ success: true, newContext });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
