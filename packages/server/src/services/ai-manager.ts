import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from 'langchain/prompts';
import * as queries from '../db/queries';

const modelCache = new Map<string, ChatGoogleGenerativeAI>();

export function getModel(modelName: string = 'gemini-1.5-flash'): ChatGoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_key_here') {
    return null;
  }

  // Normaliza aliases
  const targetModel = modelName.includes('pro') ? 'gemini-1.5-pro' :
                      modelName.includes('2.0') ? 'gemini-2.0-flash' :
                      'gemini-1.5-flash';

  if (!modelCache.has(targetModel)) {
    try {
      const instance = new ChatGoogleGenerativeAI({
        modelName: targetModel,
        apiKey,
      });
      modelCache.set(targetModel, instance);
    } catch (e) {
      console.warn(`AI Manager: Falha ao instanciar modelo ${targetModel}:`, e);
      return null;
    }
  }

  return modelCache.get(targetModel) || null;
}

export async function summarizeProject(projectId: string, modelName?: string): Promise<string> {
  const project = queries.getProject(projectId);
  const messages = queries.getProjectMessages(projectId);
  const model = getModel(modelName);

  if (!model) {
    return 'Resumo simulado: O projeto está em andamento. Foram trocadas ' + messages.length + ' mensagens.';
  }

  const prompt = PromptTemplate.fromTemplate(`
    Resuma o estado atual do projeto {projectName}.
    Mensagens recentes:
    {messages}
    
    Forneça um resumo conciso (máx 3 parágrafos) do que foi feito, blockeios e próximos passos.
  `);

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({
      projectName: project ? (project as any).name : projectId,
      messages: JSON.stringify(messages.slice(-20)), // limit to last 20 messages for context
    });
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Summarize Error:', err);
    return 'Resumo simulado (erro na IA): O projeto está em andamento. Foram trocadas ' + messages.length + ' mensagens.';
  }
}

export async function analyzeMessagePriority(
  messageContent: string, 
  projectContext: string,
  modelName?: string
): Promise<{
  priority: 'low' | 'normal' | 'high' | 'critical',
  needsHuman: boolean,
  conflictRisk: boolean
}> {
  const model = getModel(modelName);
  if (!model) {
    const lc = messageContent.toLowerCase();
    const isCritical = lc.includes('block') || lc.includes('erro') || lc.includes('ajuda');
    return {
      priority: isCritical ? 'critical' : 'normal',
      needsHuman: isCritical,
      conflictRisk: false
    };
  }

  const prompt = PromptTemplate.fromTemplate(`
    Analise a seguinte mensagem enviada por um agente em um projeto de software.
    Contexto do projeto: {context}
    
    Mensagem: "{message}"
    
    Responda EXATAMENTE em formato JSON com 3 propriedades:
    "priority": "low" | "normal" | "high" | "critical"
    "needsHuman": true | false (O gerente humano precisa intervir?)
    "conflictRisk": true | false (Há risco de conflito de código?)
  `);

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({
      context: projectContext,
      message: messageContent
    });
    const text = (result as any).content as string;
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response', e);
    return { priority: 'normal', needsHuman: false, conflictRisk: false };
  }
}

export async function generateInitialContext(projectName: string, description: string, modelName?: string): Promise<string> {
  const model = getModel(modelName);
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
  const model = getModel(modelName);
  if (!model) return currentContext + '\n\n### Análise Real Adicionada:\n' + analysisData;

  const prompt = PromptTemplate.fromTemplate(`
    Você é o Arquiteto Guardião do Contexto.
    Aqui está o contexto OFICIAL preliminar do projeto:
    {currentContext}
    
    Um agente acabou de realizar uma VARREDURA REAL NO CÓDIGO FONTE e retornou estes fatos inquestionáveis:
    {analysisData}
    
    Sua tarefa: Expanda o Contexto Oficial integrando ESSES FATOS REAIS. 
    Se a análise revelar a Stack Tecnológica (ex: Node, React, Tailwind), remova a mensagem "Aguardando varredura" e crie uma seção detalhada e profissional de "Arquitetura e Stack" EXATAMENTE com base no que foi encontrado. NÃO ALUCINE tecnologias que não foram listadas na análise.
    
    Retorne apenas o Markdown limpo do novo contexto completo.
  `);

  try {
    const chain = prompt.pipe(model as any);
    const result = await chain.invoke({ currentContext, analysisData });
    return (result as any).content as string;
  } catch (err) {
    console.error('AI Expand Context Error:', err);
    return currentContext;
  }
}

export async function updateSharedContext(currentContext: string, newUpdates: string, modelName?: string): Promise<string> {
  const model = getModel(modelName);
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
    return currentContext; // Se falhar, mantém o antigo
  }
}
