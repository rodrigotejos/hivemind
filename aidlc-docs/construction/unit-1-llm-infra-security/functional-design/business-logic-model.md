# Business Logic Model - Unit 1: Infraestrutura de LLM & Segurança

## 1. Overview
A Unit 1 estabelece a camada de infraestrutura de LLM, blindagem contra injeção de prompt, gestão inteligente de contexto (sliding window com condensação recursiva) e resiliência de subprocessos por heartbeat renovável.

---

## 2. Core Business Workflows

### 2.1 Recursive Auto-Summarization & Sliding Window (US-6)
Ao preparar o contexto para o LLM em um projeto ativo:
```mermaid
flowchart TD
    Start([Recebe Histórico de Mensagens]) --> CalcTokens[Calcula Tokens Totais via TokenService]
    CalcTokens --> CheckBudget{Tokens > Budget?}
    
    CheckBudget -- Não --> ReturnDirect[Retorna mensagens na íntegra]
    
    CheckBudget -- Sim --> Partition[Divide histórico: Mais antigas vs Recentes N]
    Partition --> CallSummary[Executa Sumarização Recursiva das Mensagens Antigas]
    CallSummary --> FormAnchor[Cria Bloco Âncora: 'Resumo do Histórico Anterior']
    FormAnchor --> Merge[Concatena: Mensagem de Sistema + Resumo + Recentes N]
    Merge --> VerifyBudget{Tokens <= Budget?}
    
    VerifyBudget -- Sim --> ReturnOptimized[Retorna Contexto Otimizado]
    VerifyBudget -- Não --> PruneOldestInRecent[Poda mensagem mais antiga de Recentes N]
    PruneOldestInRecent --> VerifyBudget
```

### 2.2 Structured Output with Reflection Loop (US-5)
Processamento determinístico para triagem de mensagens e extração de prioridade:
```mermaid
flowchart TD
    InputMsg([Mensagem de Entrada]) --> RenderPrompt[Renderiza Prompt Template JSON com Sanitização]
    RenderPrompt --> CallGemini[Invoca Gemini com responseSchema nativo]
    CallGemini --> ParseJSON{Schema Zod Válido?}
    
    ParseJSON -- Válido --> OutputResult[Retorna Objeto Estruturado Tipado]
    
    ParseJSON -- Inválido / Falha --> CheckAttempts{Tentativas < 2?}
    CheckAttempts -- Sim --> BuildReflection[Gera Prompt de Correção com Erro Zod detalhado]
    BuildReflection --> CallGemini
    
    CheckAttempts -- Não --> RaiseStructuredError[Lança SchemaValidationError estruturado]
```

### 2.3 Prompt Registry & Hot-Reload (US-7)
- Prompts desacoplados armazenados em arquivos `.json` estruturados em `packages/server/prompts/`.
- Cada arquivo contém:
  - `role`: Identificador do papel (ex: `supervisor`, `security`, `qa`, `triage`).
  - `description`: Finalidade do prompt.
  - `model`: Configuração sugerida (modelo, temperatura).
  - `messages`: Array de mensagens contendo `role` (`system` | `user` | `assistant`) e `template` com placeholders como `${projectName}`, `${context}`.
- O `PromptRegistry` mantém cache em memória com checagem de mtime ou invalidação dinâmica para hot-reload imediato sem necessidade de rebuild ou reinício do servidor.

### 2.4 Resilient Heartbeat Lease Manager (US-8)
Gerenciamento de tarefas longas no Bridge Daemon:
```mermaid
flowchart TD
    Spawn[Subprocesso Iniciado] --> InitLease[Registra Lease: lastHeartbeat = now, timeout = 60s]
    InitLease --> Loop[Timer de Inspeção a cada 5s]
    
    SubprocessHeartbeat[Subprocesso emite Heartbeat via IPC/Stdout] --> RenewLease[Atualiza lastHeartbeat = now]
    RenewLease --> Loop
    
    Loop --> CheckExpired{now - lastHeartbeat > 60s?}
    CheckExpired -- Não --> ProcessRunning{Processo ainda ativo?}
    ProcessRunning -- Sim --> Loop
    ProcessRunning -- Não --> CleanUpSuccess[Limpeza normal e reporte de término]
    
    CheckExpired -- Sim --> SendSigterm[Envia SIGTERM ao subprocesso]
    SendSigterm --> GraceWait[Aguarda Grace Period de 5s]
    GraceWait --> StillAlive{Ainda vivo?}
    StillAlive -- Sim --> SendSigkill[Envia SIGKILL forçado]
    StillAlive -- Não --> ReportDead[Registra Falha por Quebra de Lease no DB e Cockpit]
    SendSigkill --> ReportDead
```
