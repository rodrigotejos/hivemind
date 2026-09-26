import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from 'langchain/prompts';
import { z } from 'zod';
import * as queries from '../db/queries';
import { PromptRegistry } from './prompt-registry';

const modelCache = new Map<string, ChatGoogleGenerativeAI>();

export type ReasoningLevel = 'off' | 'low' | 'medium' | 'high';

export interface ModelResolution {
  targetModel: string;
  actualModelName: string;
  reasoningLevel: ReasoningLevel;
  thinkingBudget: number;
}

/**
 * Zod Schema para triagem e análise estruturada de mensagens (US-5, Security Baseline).
 */
export const MessagePrioritySchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'critical']),
  needsHuman: z.boolean(),
  conflictRisk: z.boolean(),
  reasoning: z.string().optional(),
  category: z.enum(['question', 'decision', 'blocker', 'info', 'security']).optional(),
  tags: z.array(z.string()).default([])
});

export type MessagePriorityPayload = z.infer<typeof MessagePrioritySchema>;

/**
 * Retorna o modelo meta de roteamento interno (Gerenciador do Modo Auto).
 * Estritamente configurado para 3.5 Flash Lite sem raciocínio (Reasoning: OFF, 0 tokens thinking).
 */
export function getAutoRouterModel(): ChatGoogleGenerativeAI | null {
  return getModel('gemini-3.5-flash-lite', '', 'off');
}

export function resolveModelConfig(
  requestedModel: string = 'auto', 
  promptContent: string = '',
  reasoningLevel: ReasoningLevel = 'medium'
): ModelResolution {
  const contentLower = promptContent.toLowerCase();
  
  let targetModel = requestedModel;
  let resolvedReasoning = reasoningLevel;

  // Modo AUTO: O gerenciador (3.5 Flash Lite sem raciocínio) decide o modelo de destino
  if (!requestedModel || requestedModel === 'auto') {
    const isHighComplexity = 
      contentLower.includes('arquitetura') ||
      contentLower.includes('segurança') ||
      contentLower.includes('vulnerabilidade') ||
      contentLower.includes('blocker') ||
      contentLower.includes('refactor') ||
      contentLower.includes('pbt') ||
      contentLower.includes('conflito') ||
      contentLower.includes('migration');

    const isLightTask = 
      contentLower.includes('status') ||
      contentLower.includes('ping') ||
      contentLower.includes('resumo') ||
      contentLower.length < 50;

    if (isHighComplexity) {
      targetModel = 'gemini-3.7-flash';
      resolvedReasoning = 'high';
    } else if (isLightTask) {
      targetModel = 'gemini-3.5-flash-lite';
      resolvedReasoning = 'off';
    } else {
      targetModel = 'gemini-3.5-flash';
      resolvedReasoning = 'medium';
    }
  }

  // Mapeamento normalizado para a API do Google Gemini 3
  let actualModelName = 'gemini-3.7-flash';
  if (targetModel.includes('flex')) {
    actualModelName = 'gemini-3.5-flash-lite';
  } else if (targetModel.includes('3.5-flash-lite') || targetModel.includes('lite')) {
    actualModelName = 'gemini-3.5-flash-lite';
  } else if (targetModel.includes('3.6-flash')) {
    actualModelName = 'gemini-3.6-flash';
  } else if (targetModel.includes('3.5-flash')) {
    actualModelName = 'gemini-3.5-flash';
  } else if (targetModel.includes('3.1-pro') || targetModel.includes('pro')) {
    actualModelName = 'gemini-3.7-flash';
  } else if (targetModel.includes('2.5-flash')) {
    actualModelName = 'gemini-2.5-flash';
  } else {
    actualModelName = 'gemini-3.7-flash';
  }

  // Thinking Budget por Reasoning Level
  const thinkingBudget = 
    resolvedReasoning === 'off' ? 0 :
    resolvedReasoning === 'low' ? 2048 :
    resolvedReasoning === 'high' ? 32768 :
    8192; // medium default

  return {
    targetModel,
    actualModelName,
    reasoningLevel: resolvedReasoning,
    thinkingBudget,
  };
}

export function getModel(
  modelName: string = 'auto', 
  promptContent: string = '', 
  reasoningLevel: ReasoningLevel = 'medium'
): ChatGoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_key_here') {
    return null;
  }

  const { actualModelName } = resolveModelConfig(modelName, promptContent, reasoningLevel);

  if (!modelCache.has(actualModelName)) {
    try {
      const instance = new ChatGoogleGenerativeAI({
        modelName: actualModelName,
        apiKey,
      });
      modelCache.set(actualModelName, instance);
    } catch (e) {
      console.warn(`AI Manager: Falha ao instanciar modelo ${actualModelName}:`, e);
      return null;
    }
  }

  return modelCache.get(actualModelName) || null;
}

/**
 * Estimativa rápida de tokens (média de 4 caracteres por token em texto/código)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calcula a janela deslizante de mensagens com Sumarização Recursiva das mensagens antigas (US-6).
 */
export async function calculateTokenWindow(
  messages: any[],
  maxTokens: number = 8000,
  projectId?: string
): Promise<{ messages: any[]; isSummarized: boolean; summaryHeader?: string }> {
  if (!messages || messages.length === 0) {
    return { messages: [], isSummarized: false };
  }

  let totalEstimatedTokens = messages.reduce((acc, m) => acc + estimateTokenCount(m.content || ''), 0);

  // Se cabe dentro do budget, retorna na íntegra
  if (totalEstimatedTokens <= maxTokens) {
    return { messages, isSummarized: false };
  }

  // Se excede, preserva as últimas 10 mensagens (ou metade) e sumariza o histórico anterior
  const recentCount = Math.max(5, Math.min(15, Math.floor(messages.length / 2)));
  const olderMessages = messages.slice(0, messages.length - recentCount);
  const recentMessages = messages.slice(messages.length - recentCount);

  let condensedSummary = '';
  if (olderMessages.length > 0) {
    try {
      const model = getAutoRouterModel() || getModel('gemini-3.5-flash-lite');
      if (model) {
        const textToSummarize = olderMessages
          .map(m => `[${m.fromAgentId || m.agentId || 'User'}]: ${m.content}`)
          .join('\n');
        
        const summaryPrompt = `Resuma de forma ultra-concisa em no máximo 2 parágrafos o histórico anterior das seguintes mensagens de projeto de software:\n\n${textToSummarize.slice(0, 10000)}`;
        const res = await model.invoke(summaryPrompt);
        condensedSummary = (res as any).content as string;
      }
    } catch (err) {
      console.warn('Erro ao sumarizar bloco antigo, usando fallback truncado:', err);
      condensedSummary = `[Histórico anterior de ${olderMessages.length} mensagens condensado por limite de tokens.]`;
    }
  }

  const summaryMessage = {
    id: 'summary-anchor',
    fromAgentId: 'system-summarizer',
    content: `[RESUMO DO HISTÓRICO ANTERIOR]: ${condensedSummary || 'Discussão preliminar em andamento.'}`,
    type: 'statement',
    priority: 'normal',
    timestamp: new Date().toISOString()
  };

  const finalMessages = [summaryMessage, ...recentMessages];
  return {
    messages: finalMessages,
    isSummarized: true,
    summaryHeader: condensedSummary
  };
}

/**
 * Invoca a LLM com garantia de saída estruturada Zod e Reflection Loop de autocorreção (US-5, Resiliency Baseline).
 */
export async function generateStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  systemPrompt: string,
  userMessage: string,
  modelInstance?: ChatGoogleGenerativeAI | null,
  maxReflectionAttempts: number = 2
): Promise<T> {
  const model = modelInstance || getAutoRouterModel() || getModel('gemini-3.5-flash-lite');
  if (!model) {
    throw new Error('Provedor LLM não disponível para Structured Output.');
  }

  let prompt = `${systemPrompt}\n\nMENSAGEM:\n${userMessage}\n\nRetorne EXATAMENTE um objeto JSON válido.`;
  let lastError = '';

  for (let attempt = 0; attempt <= maxReflectionAttempts; attempt++) {
    try {
      const result = await model.invoke(prompt);
      const rawText = ((result as any).content as string) || '';
      
      // Sanitização de blocos markdown
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const jsonParsed = JSON.parse(cleaned);
      const validation = schema.safeParse(jsonParsed);

      if (validation.success) {
        return validation.data;
      }

      // Falha na validação do Zod -> Monta Reflection Loop para a próxima tentativa
      lastError = JSON.stringify(validation.error.format());
      console.warn(`[StructuredOutput] Tentativa ${attempt + 1} falhou validação Zod: ${lastError}. Acionando Reflection Loop...`);
      
      prompt = `${systemPrompt}\n\nMENSAGEM ANTERIOR:\n${userMessage}\n\nSUA RESPOSTA ANTERIOR FOI INVÁLIDA:\n${rawText}\n\nERRO DE SCHEMA ENCONTRADO:\n${lastError}\n\nCorrija imediatamente e retorne SOMENTE o JSON corrigido estritamente aderente ao schema solicitado.`;
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[StructuredOutput] Erro de parse JSON na tentativa ${attempt + 1}: ${lastError}`);
      prompt = `${systemPrompt}\n\nMENSAGEM:\n${userMessage}\n\nA resposta anterior não foi um JSON válido. Retorne EXATAMENTE um JSON puro sem markdown ou texto explicativo.`;
    }
  }

  throw new Error(`Falha definitiva ao produzir JSON estruturado após ${maxReflectionAttempts + 1} tentativas. Último erro: ${lastError}`);
}

export async function summarizeProject(projectId: string, modelName?: string, reasoningLevel?: ReasoningLevel): Promise<string> {
  const project = queries.getProject(projectId);
  const messages = queries.getProjectMessages(projectId);
  const model = getModel(modelName, '', reasoningLevel);

  if (!model) {
    return 'Resumo simulado: O projeto está em andamento. Foram trocadas ' + messages.length + ' mensagens.';
  }

  // Usa o PromptRegistry desacoplado (US-7)
  const registry = PromptRegistry.getInstance();
  let rendered;
  try {
    rendered = registry.renderPrompt('summarize_project', {
      projectName: project ? (project as any).name : projectId,
      messages: JSON.stringify(messages.slice(-25))
    });
  } catch {
    rendered = {
      fullText: `Resuma o estado atual do projeto ${project ? (project as any).name : projectId}.\nMensagens: ${JSON.stringify(messages.slice(-20))}`
    };
  }

  try {
    const result = await model.invoke(rendered.fullText);
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Summarize Error:', err);
    return 'Resumo simulado (erro na IA): O projeto está em andamento. Foram trocadas ' + messages.length + ' mensagens.';
  }
}

/**
 * Análise de prioridade e risco das mensagens com Structured Output e Reflection Loop (US-5).
 */
export async function analyzeMessagePriority(
  messageContent: string, 
  projectContext: string,
  modelName?: string,
  reasoningLevel?: ReasoningLevel
): Promise<{
  priority: 'low' | 'normal' | 'high' | 'critical',
  needsHuman: boolean,
  conflictRisk: boolean,
  resolvedModel?: string
}> {
  const model = getAutoRouterModel() || getModel(modelName, messageContent, reasoningLevel);

  if (!model) {
    const lc = messageContent.toLowerCase();
    const isCritical = lc.includes('block') || lc.includes('erro') || lc.includes('ajuda');
    return {
      priority: isCritical ? 'critical' : 'normal',
      needsHuman: isCritical,
      conflictRisk: false,
      resolvedModel: 'gemini-3.5-flash-lite',
    };
  }

  const registry = PromptRegistry.getInstance();
  let systemDirective = `Analise a mensagem de um agente e forneça estritamente JSON com priority, needsHuman, conflictRisk. Contexto: ${projectContext}`;
  try {
    const rendered = registry.renderPrompt('triage', {
      projectName: 'Projeto Atual',
      messageContent
    });
    systemDirective = rendered.fullText;
  } catch {
    // Mantém fallback limpo
  }

  try {
    const structured = await generateStructuredOutput(
      MessagePrioritySchema,
      systemDirective,
      messageContent,
      model,
      2
    );

    return {
      priority: structured.priority,
      needsHuman: structured.needsHuman,
      conflictRisk: structured.conflictRisk,
      resolvedModel: 'gemini-3.5-flash-lite'
    };
  } catch (e) {
    console.error('[analyzeMessagePriority] Falha após reflection loop:', e);
    const lc = messageContent.toLowerCase();
    const isCritical = lc.includes('block') || lc.includes('erro') || lc.includes('crítico');
    return { 
      priority: isCritical ? 'critical' : 'normal', 
      needsHuman: isCritical, 
      conflictRisk: false, 
      resolvedModel: 'gemini-3.5-flash-lite' 
    };
  }
}

export async function generateInitialContext(projectName: string, description: string, modelName?: string): Promise<string> {
  const model = getModel(modelName, description);
  if (!model) {
    return `# Contexto: ${projectName}\n\n${description || 'Projeto sem descrição.'}\n\n*Nota: Aguardando análise real do código.*`;
  }

  const prompt = PromptTemplate.fromTemplate(`
    Você é um Arquiteto de Software AI. O projeto "{projectName}" acaba de ser criado.
    Descrição inicial fornecida pelo usuário: "{description}"
    
    Escreva um "Contexto Base do Projeto" preliminar em Markdown.
    Estruture em:
    - Visão Geral
    - Objetivos Principais
    - Status da Arquitetura
    
    REGRA CRÍTICA: NÃO INVENTE NENHUMA TECNOLOGIA, ARQUITETURA OU STACK. Na seção "Status da Arquitetura", escreva exatamente: "Aguardando agentes realizarem a varredura e leitura do código fonte real para definir a Stack."
  `);

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({ projectName, description: description || '' });
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Init Context Error:', err);
    return `# Contexto: ${projectName}\n\n${description}\n\n*Nota: Falha ao gerar via AI.*`;
  }
}

export async function expandContextWithRealData(currentContext: string, analysisData: string, modelName?: string): Promise<string> {
  const model = getModel(modelName, analysisData);

  if (!model) {
    let base = currentContext.replace(/\*?\s*Nota:\s*Aguardando análise real do código\.?\s*\*?/gi, '').trim();
    if (base.includes('### Análise Real') || base.includes('### Resumo')) {
      return base + '\n\n' + analysisData;
    }
    return `${base}\n\n## 🏛️ Arquitetura, Módulos & Análise Técnica Real\n${analysisData}\n\n---\n*Contexto atualizado pelos agentes em conformidade com o ciclo AI-DLC.*`;
  }

  const prompt = PromptTemplate.fromTemplate(`
    Você é o Arquiteto Guardião do Contexto Técnico.
    Aqui está o contexto OFICIAL preliminar do projeto:
    {currentContext}
    
    Os agentes acabaram de realizar uma ANÁLISE REAL NO CÓDIGO FONTE do repositório e retornaram estes fatos técnicos:
    {analysisData}
    
    Sua tarefa:
    1. Remova completamente qualquer mensagem como "Aguardando análise real", "Aguardando varredura" ou placeholders preliminares.
    2. Crie uma documentação técnica oficial, profissional e estruturada em Markdown com as seções:
       - 📌 **Visão Geral e Objetivos do Projeto**
       - 📦 **Mapeamento de Módulos, Pacotes e Dependências**
       - 🏛️ **Arquitetura do Sistema, Rotas e Fluxo de Dados**
       - 🧪 **Estratégia de Testes e Qualidade (QA & PBT)**
       - 🔒 **Segurança e Diretrizes de Engenharia**
    3. Seja detalhado, utilize tabelas, listas e diagramas conceituais quando apropriado.
    4. NÃO invente tecnologias que não constam na análise.
    
    Retorne apenas o Markdown limpo e completo da nova Wiki Técnica.
  `);

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({ currentContext, analysisData });
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Expand Context Error:', err);
    let base = currentContext.replace(/\*?\s*Nota:\s*Aguardando análise real do código\.?\s*\*?/gi, '').trim();
    return `${base}\n\n## 🏛️ Arquitetura, Módulos & Análise Técnica Real\n${analysisData}\n\n---\n*Contexto atualizado pelos agentes em conformidade com o ciclo AI-DLC.*`;
  }
}

export async function generateUIComponent(
  componentName: string,
  userPrompt: string,
  designTokens: any,
  modelName: string = 'gemini-flex'
): Promise<string> {
  const model = getModel(modelName, userPrompt, 'medium');

  const systemInstructions = `Você é o Alpha (Frontend), especialista em desenvolvimento de interfaces modernas com React 19, TypeScript e TailwindCSS.
Sua missão é gerar um componente React 19 completo, auto-contido, interativo e visualmente deslumbrante no padrão Dark Mode Glassmorphism com TailwindCSS.

REGRAS DE CÓDIGO OBRIGATÓRIAS:
1. Exportação como função padrão com o nome exato: "export function ${componentName}() { ... }".
2. Não use imports externos não padrão. Use ícones do 'lucide-react' (como Sparkles, Star, MapPin, Heart, ArrowRight, Check, Shield, Activity) ou SVGs inline.
3. Utilize TailwindCSS moderno (bg-zinc-950, text-white, border-zinc-800, gradientes indigo/cyan, backdrop-blur).
4. Inclua estados interativos com useState (ex: favoritos, contadores, tabs ou botão de reserva interativo).
5. Responda APENAS com o bloco de código TypeScript/TSX delimitado por \`\`\`tsx e \`\`\`. Sem explicações desnecessárias fora do bloco.`;

  const prompt = PromptTemplate.fromTemplate(`
    {systemInstructions}

    Nome do Componente: {componentName}
    Especificação / Descrição da UI: {userPrompt}
    Design Tokens do Figma: {designTokens}
  `);

  if (!model) {
    return `import { useState } from 'react';
import { Sparkles, Star, Check, ArrowRight } from 'lucide-react';

export function ${componentName}() {
  const [reserved, setReserved] = useState(false);

  return (
    <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-xl space-y-4">
      <div className="relative overflow-hidden rounded-xl h-44 bg-gradient-to-tr from-indigo-950 via-purple-950 to-cyan-950 flex items-center justify-center border border-white/10">
        <Sparkles className="text-cyan-400 animate-pulse" size={40} />
        <span className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
          20% OFF
        </span>
      </div>
      <div>
        <h4 className="text-lg font-bold text-white tracking-tight">${componentName}</h4>
        <p className="text-xs text-zinc-400 mt-1">Componente gerado pelo Alpha Frontend em conformidade com o AI-DLC.</p>
      </div>
      <button 
        onClick={() => setReserved(!reserved)}
        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
      >
        {reserved ? '✓ Reservado com Sucesso' : 'Confirmar Reserva'}
      </button>
    </div>
  );
}`;
  }

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({
      systemInstructions,
      componentName,
      userPrompt: userPrompt || 'Card de UI interativo para travel_fun',
      designTokens: JSON.stringify(designTokens || {}),
    });
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Generate UI Error:', err);
    throw err;
  }
}

export async function updateSharedContext(currentContext: string, newUpdates: string, modelName?: string): Promise<string> {
  const model = getModel(modelName, newUpdates);
  if (!model) return currentContext + '\n\n### Novos Updates:\n' + newUpdates;

  const prompt = PromptTemplate.fromTemplate(`
    Você é o Guardião do Contexto Técnico. Aqui está a documentação OFICIAL atual do projeto (Wiki Técnica):
    {currentContext}
    
    A equipe tomou a seguinte decisão técnica no chat:
    {newUpdates}
    
    REGRA CRÍTICA 1: O Contexto Base deve ser uma documentação puramente técnica do ESTADO ATUAL do código e da arquitetura. Ele será lido por novos desenvolvedores (IAs) que entrarem no projeto.
    REGRA CRÍTICA 2: NÃO adicione histórico de conversa ("O usuário pediu", "O agente disse", "Decidimos que"). Aja como se a documentação oficial tivesse sido atualizada de forma orgânica.
    REGRA CRÍTICA 3: Mantenha ou adicione uma seção "O que está faltando / Próximos Passos" se houver bloqueios ou pendências reportadas.
    
    Incorpore a nova decisão na documentação técnica mantendo o tom estritamente impessoal e de engenharia.
    Retorne apenas o Markdown limpo do novo contexto completo.
  `);

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({ currentContext, newUpdates });
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Update Context Error:', err);
    return currentContext;
  }
}
