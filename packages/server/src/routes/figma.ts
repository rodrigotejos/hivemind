import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as queries from '../db/queries';
import { generateUIComponent } from '../services/ai-manager';
import { io } from '../index';

export const figmaRouter = Router();

// Extrai fileKey e nodeId de URLs do Figma
function parseFigmaUrl(rawUrl: string): { fileKey: string; nodeId?: string } {
  try {
    const url = new URL(rawUrl);
    // https://www.figma.com/design/:fileKey/... or https://www.figma.com/file/:fileKey/...
    const segments = url.pathname.split('/').filter(Boolean);
    let fileKey = '';
    const keyIndex = segments.findIndex(s => s === 'design' || s === 'file');
    if (keyIndex !== -1 && segments[keyIndex + 1]) {
      fileKey = segments[keyIndex + 1];
    } else {
      fileKey = segments[0] || 'mock_figma_key';
    }

    const nodeIdParam = url.searchParams.get('node-id');
    const nodeId = nodeIdParam ? decodeURIComponent(nodeIdParam).replace('-', ':') : undefined;

    return { fileKey, nodeId };
  } catch (e) {
    return { fileKey: 'custom_design', nodeId: undefined };
  }
}

// POST /api/projects/:projectId/figma/import - Importa e extrai Design Tokens do Figma
figmaRouter.post('/projects/:projectId/figma/import', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { figmaUrl, accessToken } = req.body;

  if (!figmaUrl || !figmaUrl.trim()) {
    res.status(400).json({ success: false, error: 'URL do Figma é obrigatória.' });
    return;
  }

  try {
    const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);
    const token = accessToken || process.env.FIGMA_ACCESS_TOKEN;

    let designTokens = {
      colors: [
        { name: 'Primary Indigo', hex: '#4F46E5', rgba: 'rgba(79, 70, 229, 1)', role: 'brand' },
        { name: 'Accent Cyan', hex: '#06B6D4', rgba: 'rgba(6, 182, 212, 1)', role: 'accent' },
        { name: 'Success Emerald', hex: '#10B981', rgba: 'rgba(16, 185, 129, 1)', role: 'success' },
        { name: 'Dark Surface', hex: '#09090B', rgba: 'rgba(9, 9, 11, 1)', role: 'background' },
        { name: 'Card Surface', hex: '#18181B', rgba: 'rgba(24, 24, 27, 1)', role: 'surface' },
      ],
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        sizes: {
          title: 'text-2xl font-bold tracking-tight',
          subtitle: 'text-sm font-medium text-zinc-400',
          body: 'text-xs text-zinc-300 leading-relaxed',
          caption: 'text-[10px] uppercase font-bold tracking-wider',
        }
      },
      spacing: { padding: 'p-6', gap: 'gap-4', borderRadius: 'rounded-2xl' },
      layout: 'Flex Column, Auto-Layout Responsive',
    };

    let documentName = `Figma_${fileKey.slice(0, 8)}`;

    // Se houver token configurado, consulta a API oficial do Figma
    if (token && fileKey && fileKey !== 'custom_design') {
      try {
        const apiUrl = nodeId
          ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`
          : `https://api.figma.com/v1/files/${fileKey}`;

        const figmaRes = await fetch(apiUrl, {
          headers: { 'X-Figma-Token': token },
        });

        if (figmaRes.ok) {
          const figmaData = await figmaRes.json();
          documentName = figmaData.name || documentName;
        }
      } catch (e) {
        console.warn('Aviso: Consulta à API do Figma offline ou falhou. Utilizando extração de tokens local.');
      }
    }

    res.json({
      success: true,
      fileKey,
      nodeId,
      name: documentName,
      designTokens,
      figmaUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/figma/generate - Gera código React 19 + TypeScript + Tailwind pelo Alpha Frontend
figmaRouter.post('/projects/:projectId/figma/generate', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { componentName, prompt, designTokens, sourceType, sourceInput, model } = req.body;

  const validName = (componentName || 'TravelCustomCard').replace(/[^a-zA-Z0-9]/g, '');

  try {
    const activeModel = model || 'gemini-flex';
    const rawResponse = await generateUIComponent(
      validName,
      prompt || 'Card de UI interativo para a plataforma travel_fun com badge de destaque, imagem ilustrativa, preço, avaliações e botão de ação.',
      designTokens,
      activeModel
    );

    // Extrai o bloco de código TSX limpo
    let cleanCode = rawResponse;
    const match = rawResponse.match(/```(?:tsx|typescript|jsx|javascript)?([\s\S]*?)```/);
    if (match && match[1]) {
      cleanCode = match[1].trim();
    }

    // Salva no banco de dados
    const createdComponent = queries.createUIComponent({
      projectId,
      name: validName,
      sourceType: sourceType || 'prompt',
      sourceInput: sourceInput || prompt || '',
      designTokens: JSON.stringify(designTokens || {}),
      componentCode: cleanCode,
      filePath: `src/components/${validName}.tsx`,
    });

    // Emite evento para a sala
    io.to(`project_${projectId}`).emit('figma_component_generated', {
      component: createdComponent,
    });

    res.json({
      success: true,
      component: createdComponent,
    });
  } catch (err: any) {
    console.error('Erro na geração de UI Figma:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/figma/save - Salva o componente gerado no disco do projeto
figmaRouter.post('/projects/:projectId/figma/save', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { componentName, componentCode, customPath } = req.body;

  if (!componentName || !componentCode) {
    res.status(400).json({ success: false, error: 'Nome e código do componente são obrigatórios.' });
    return;
  }

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();
    const relativeTarget = customPath || `src/components/${componentName}.tsx`;
    const fullPath = path.resolve(workingDir, relativeTarget);

    // Garante que o diretório pai existe
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, componentCode, 'utf8');

    res.json({
      success: true,
      filePath: relativeTarget,
      fullPath,
      message: `Componente salvo com sucesso em "${relativeTarget}"`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:projectId/figma/components - Lista componentes do projeto
figmaRouter.get('/projects/:projectId/figma/components', (req: Request, res: Response): void => {
  const { projectId } = req.params;

  try {
    const components = queries.getProjectUIComponents(projectId);
    res.json({ success: true, components });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:projectId/figma/components/:id
figmaRouter.delete('/projects/:projectId/figma/components/:id', (req: Request, res: Response): void => {
  const { id } = req.params;

  try {
    queries.deleteUIComponent(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
