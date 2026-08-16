# Feature Functional Design: Gemini Model Matrix, Reasoning Budget & Auto-Adaptive Scaling

## 1. Model Matrix & Reasoning Architecture

### 1.1 Catálogo de Modelos
1. **`auto` (Modo Adaptativo Inteligente)**:
   - Analisa dinamicamente a complexidade do prompt e do contexto.
   - Para mensagens curtas / rotineiras: escala para `gemini-2.5-flash-lite`.
   - Para integrações padrão: escala para `gemini-3.5-flash` / `gemini-3.6-flash`.
   - Para blockers críticos, PBT, arquitetura ou conflitos: escala para `gemini-3.7-flash` ou `gemini-3.1-pro` com reasoning alto.
2. **`gemini-2.5-flash-lite` / `3.5-flash-lite`**: Ultra-leve, latência mínima, consumo quase zero de tokens.
3. **`gemini-3.5-flash`**: Equilíbrio veloz para tarefas ágeis de frontend e backend.
4. **`gemini-3.6-flash`**: Alta precisão em chamadas de ferramentas e JSON estruturado.
5. **`gemini-3.7-flash`**: Modelo de fronteira com suporte a raciocínio híbrido e thinking dinâmico.
6. **`gemini-3.1-pro`**: Modelo mestre para raciocínio profundo, refatoração de larga escala e análise adversarial.

---

## 2. Níveis de Raciocínio (Reasoning Budget)

- **`off`**: Respostas instantâneas sem etapa de reflexão profunda (máxima velocidade).
- **`low`**: Thinking leve (~2.000 tokens) para validações simples de código.
- **`medium`**: Thinking moderado (~8.000 tokens) para lógica de negócio e integrações.
- **`high`**: Thinking completo (~32.000 tokens) para análise arquitetural, segurança e provas de propriedades (PBT).

---

## 3. Persistência & LangGraph Engine

- `task_sessions`: Novas colunas `model TEXT DEFAULT 'auto'` e `reasoning_level TEXT DEFAULT 'medium'`.
- `AgentGraphState`: Propriedades `model?: string` e `reasoningLevel?: 'off' | 'low' | 'medium' | 'high'`.
- `ai-manager.ts`: Resolução inteligente do modelo no modo `auto` com injeção de parâmetros de thinking.
