import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export const PromptMessageTemplateSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  template: z.string()
});

export const PromptDefinitionSchema = z.object({
  id: z.string(),
  role: z.string(),
  version: z.string(),
  description: z.string(),
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.2),
  messages: z.array(PromptMessageTemplateSchema)
});

export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;

export interface RenderedPrompt {
  id: string;
  defaultModel?: string;
  temperature: number;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  fullText: string;
}

interface CachedPrompt {
  definition: PromptDefinition;
  mtime: number;
}

export class PromptRegistry {
  private static instance: PromptRegistry;
  private cache = new Map<string, CachedPrompt>();
  private promptsDir: string;

  private constructor(customDir?: string) {
    this.promptsDir = customDir || path.resolve(__dirname, '../../prompts');
  }

  public static getInstance(customDir?: string): PromptRegistry {
    if (!PromptRegistry.instance || customDir) {
      PromptRegistry.instance = new PromptRegistry(customDir);
    }
    return PromptRegistry.instance;
  }

  /**
   * Sanitiza valores de variáveis substituídas no template para prevenir ataques de prompt injection.
   */
  public sanitizeVariable(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Remove marcadores de escape de instruções de sistema maliciosos
    return str
      .replace(/<\/?system>/gi, '')
      .replace(/<\/?instructions>/gi, '')
      .trim();
  }

  /**
   * Carrega e valida um prompt por ID com hot-reload automático via verificação de mtime.
   */
  public getPrompt(id: string): PromptDefinition {
    const filePath = path.join(this.promptsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt template not found: "${id}" at path ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const cached = this.cache.get(id);

    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.definition;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    const parsed = PromptDefinitionSchema.parse(json);

    this.cache.set(id, {
      definition: parsed,
      mtime: stats.mtimeMs,
    });

    return parsed;
  }

  /**
   * Renderiza um template substituindo ${key} pelas variáveis fornecidas de forma segura.
   */
  public renderPrompt(id: string, variables: Record<string, any> = {}): RenderedPrompt {
    const prompt = this.getPrompt(id);

    const renderedMessages = prompt.messages.map(msg => {
      let content = msg.template;
      for (const [key, val] of Object.entries(variables)) {
        const sanitized = this.sanitizeVariable(val);
        // Substitui todas as ocorrências de ${key}
        content = content.split(`\${${key}}`).join(sanitized);
      }
      return {
        role: msg.role,
        content
      };
    });

    const fullText = renderedMessages.map(m => m.content).join('\n\n');

    return {
      id: prompt.id,
      defaultModel: prompt.defaultModel,
      temperature: prompt.temperature,
      messages: renderedMessages,
      fullText
    };
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
