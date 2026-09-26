# Unit of Work Dependency Matrix

A estratégia definida é de execução **Sequencial e Bloqueante** (Full-Stack). A matriz abaixo indica a ordem de precedência rigorosa para implementação.

| Unit of Work | Depends On | Rationale |
| :--- | :--- | :--- |
| **Unit 1: Infraestrutura LLM & Segurança** | *None* | Fundacional. Estabelece a confiabilidade do payload JSON e estabilidade de tokens antes de nos preocuparmos com UI. |
| **Unit 2: Cockpit Streaming & UI** | Unit 1 | Apenas com a base do LLM estável (e prompts isolados) podemos modificar de forma segura a assinatura de retorno para Streams no backend, impactando diretamente o frontend. |
| **Unit 3: Git Supervisor & Commit Approval** | Unit 2 | A funcionalidade final exige que o fluxo reativo do Cockpit já esteja funcionando para que os eventos interativos (botão Aprovar Diff) transitem pela conexão WebSocket estabelecida na Unidade 2. |
