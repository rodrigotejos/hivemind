# Feature Functional Design: Dynamic Model Selection per Task Session

## 1. Domain & Business Requirements

### 1.1 Objetivo
Permitir que o engenheiro escolha dinamicamente qual modelo de inteligência artificial coordenará cada sessão de chat ou tarefa no Hivemind:
- **`gemini-1.5-flash`** (Padrão): Ultra-rápido, econômico, ideal para tarefas rotineiras e debates ágeis de código.
- **`gemini-1.5-pro`**: Raciocínio profundo, ideal para arquitetura complexa, refatorações amplas e decisões de alto impacto.
- **`gemini-2.0-flash`**: Nova geração com alta velocidade e raciocínio multimodal aprimorado.
- **`claude-3-5-sonnet`**: Modelo de referência em engenharia de software e geração de código de alta fidelidade (via bridge local / LangChain).

---

## 2. Modelagem & Persistência

### 2.1 Tabela `task_sessions`
- Nova coluna: `model TEXT DEFAULT 'gemini-1.5-flash'`.

### 2.2 Invocação Dinâmica no AI Manager e LangGraph
- `ai-manager.ts` e `nodes.ts`: O método `getModel(modelName?: string)` instancia a versão solicitada do modelo via SDK do `@google/genai` (ou `@google/generative-ai`) dinamicamente com base no `state.model` ou `session.model`.
- Se nenhum modelo for especificado, utiliza `gemini-1.5-flash` por padrão com resiliência e fallback automático.

---

## 3. Experiência de Usuário (UI)

- **Cockpit no Chat**: Seletor rápido de modelo ao lado do input de objetivo e botão de disparo.
- **Modal de Criação de Tarefa**: Dropdown estilizado com ícone de CPU/IA e descritivo de cada modelo.
- **Header da Sessão**: Badge indicando o modelo ativo na tarefa atual (ex: `⚡ Gemini 1.5 Flash` ou `🧠 Gemini 1.5 Pro`).
