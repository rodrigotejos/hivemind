# User Personas

## 1. Human Supervisor (Product Owner / Tech Lead)
- **Role**: Coordenador humano da equipe de agentes do AI-DLC.
- **Goals**: Acompanhar o progresso dos agentes, aprovar/rejeitar decisões arquiteturais e supervisionar o commit das mudanças geradas.
- **Pain Points**: Quando os agentes demoram muito e a UI fica travada sem feedback visual (falta de streaming). Dificuldade em saber o que exatamente os agentes mudaram antes de fazer um push (falta de diff/commit approval no Cockpit).
- **Needs**: Feedback visual em tempo real (typing, thinking states), alertas não intrusivos em caso de retentativas da API, e uma interface de revisão de Diff clara antes do código ser comitado.

## 2. System Administrator (DevOps / Plataforma)
- **Role**: Responsável pela saúde da infraestrutura, chaves de API, custos e estabilidade do Bridge Daemon.
- **Goals**: Manter o uso de tokens sob controle, garantir que o pipeline de LangGraph não caia por causa de falhas de JSON do Gemini, e facilitar o hot-reload de prompts.
- **Pain Points**: Prompts hardcoded que exigem deploy para alterar; travamentos de pipeline por "JSON malformado"; estouro de tokens porque a sumarização é rudimentar (`slice(-20)`).
- **Needs**: Prompts desacoplados, respostas do LLM blindadas contra injection (Structured Outputs), contagem de tokens eficiente usando sliding windows, e alta disponibilidade do daemon assíncrono.
