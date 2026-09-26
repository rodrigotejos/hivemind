# Components

## 1. AIManager Component (`server/src/services/ai-manager.ts`)
- **Purpose**: Classe central de orquestração de LLM (LangChain/Gemini).
- **Responsibilities**: Inicializar o LLM com as flags corretas (Structured Output), processar mensagens com sliding window de tokens, e invocar o provedor com retry em caso de timeout.
- **Interfaces**: Expõe métodos para conversação padrão, extração estruturada de JSON, e streaming iterável.

## 2. SocketGateway (`server/src/services/socket.ts` / UI Cockpit)
- **Purpose**: Canal de comunicação bidirecional em tempo real entre Engine e Cockpit.
- **Responsibilities**: Emitir chunks de texto (deltas) para o frontend concatenar, notificar status do agente (thinking, typing, erro, retrying).
- **Interfaces**: WebSockets Event Emitters.

## 3. PromptRegistry (`server/src/prompts/`)
- **Purpose**: Camada de armazenamento e recuperação de system prompts.
- **Responsibilities**: Ler arquivos Markdown do disco dinamicamente a cada nova requisição para suportar Hot-Reload.
- **Interfaces**: FileSystem I/O e métodos de cache local para evitar leituras excessivas em disco.

## 4. GitSupervisor (`server/src/services/git.ts`)
- **Purpose**: Sub-agente ou serviço que interage nativamente com o CLI do Git.
- **Responsibilities**: Criar novas branches, aplicar as modificações propostas pelo LLM no File System, gerar o Diff nativo, e efetuar o Merge/Commit se aprovado pela UI.
- **Interfaces**: ChildProcess (execução shell), retornos formatados do Git Status/Diff.

## 5. RecoveryCache (`server/src/services/cache.ts`)
- **Purpose**: Armazenamento de estado das retentativas do LLM.
- **Responsibilities**: Gravar o status "retrying" de um nó específico, para que possa ser consultado independentemente se o node process reiniciar (in-memory/Redis wrapper).
- **Interfaces**: Get/Set/TTL.
