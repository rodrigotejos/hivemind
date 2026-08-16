# User & Agent Personas: Hivemind Autonomous Ecosystem

## 1. Human Stakeholders

### Persona 1: Rodrigo (Engenheiro Chefe & Human-in-the-Loop Authority)
- **Papel**: Dono do Projeto, Arquiteto Chefe e Autoridade Final.
- **Perfil**: Engenheiro de software sênior gerenciando múltiplos módulos em paralelo usando agentes de IA.
- **Objetivos**:
  - Delegar tarefas complexas para agentes especialistas sem precisar microgerenciar comandos manuais a cada segundo.
  - Acompanhar visualmente a evolução do código, decisões tomadas e conversas em tempo real via Web Dashboard.
  - Intervir pontualmente quando blockers, divergências ou decisões de arquitetura de alto impacto forem detectadas.
  - Garantir que todo o histórico, código e telemetria de custos permaneçam íntegros, auditáveis e salvos em nuvem.
- **Dores & Desafios**:
  - Perda de tempo ao alternar manualmente entre múltiplos chats e terminals copiando e colando outputs.
  - Risco de IAs entrarem em loops infinitos ou consumirem tokens desnecessariamente sem convergir.
  - Dificuldade em manter um contexto técnico único e livre de alucinações entre ferramentas diferentes.

---

## 2. Autonomous AI Agent Personas

### Persona 2: AI Manager (LangGraph Supervisor & Convergence Arbiter)
- **Papel**: Orquestrador de Estados, Guardião do Contexto e Supervisor do LangGraph.
- **Perfil**: Agente alimentado por LangChain/LangGraph e Gemini 1.5 com foco em controle de fluxo, síntese de contexto e mitigação de loops.
- **Responsabilidades**:
  - Avaliar mensagens trocadas no grafo e decidir qual agente especialista deve ser disparado em seguida.
  - Avaliar convergência de tarefas e disparar `interrupt()` para obter autorização humana em passos críticos.
  - Atualizar o `shared_context` (wiki técnica oficial) de forma orgânica e impessoal.
  - Enviar spans e métricas de execução para o LangSmith.

### Persona 3: Alpha (Frontend & UI/UX Specialist)
- **Papel**: Engenheiro de Frontend e Interfaces.
- **Skill Atribuída**: `frontend-engineer` + `ui-figma-reader`.
- **Responsabilidades**:
  - Implementar componentes React 19, layouts responsivos com TailwindCSS e rotas SPA.
  - Consumir especificações de design, design tokens e schemas de API postados pelo Agente Backend.
  - Reportar dúvidas de interface e blockers de integração diretamente no Hivemind.

### Persona 4: Beta (Backend & API Specialist)
- **Papel**: Engenheiro de Backend, APIs e Banco de Dados.
- **Skill Atribuída**: `backend-engineer`.
- **Responsabilidades**:
  - Criar rotas Express, middlewares de validação, controllers e schemas relacionais no SQLite/Postgres.
  - Definir e documentar contratos de API e modelos de dados para que o Frontend e o QA consumam.
  - Executar refatorações de código no servidor com proteção contra injeções e falhas de I/O.

### Persona 5: Gamma (QA & Property-Based Testing Specialist)
- **Papel**: Engenheiro de Qualidade de Software e Automação de Testes.
- **Skill Atribuída**: `qa-engineer`.
- **Responsabilidades**:
  - Desenvolver testes unitários, de integração e testes baseados em propriedades (PBT) com validação de invariantes e round-trips.
  - Validar se novas alterações quebraram contratos ou geraram regressões.
  - Notificar imediatamente o time com mensagens do tipo `blocker` caso um teste crítico falhe.

### Persona 6: Delta (Adversarial Security & Red Team Specialist)
- **Papel**: Auditor de Segurança e Análise Adversarial.
- **Skill Atribuída**: `security-adversarial`.
- **Responsabilidades**:
  - Auditar propostas de código em busca de vulnerabilidades (XSS, SQL Injection, vazamento de chaves).
  - Executar o fluxo iterativo Red Team vs. Blue Team propondo cenários de ataque e verificando defesas.
  - Bloquear deploys e mesclagens que violem o Security Baseline (SECURITY-01 a SECURITY-06).

### Persona 7: Epsilon (DevOps, Infrastructure & Cloud Backup Specialist)
- **Papel**: Engenheiro de Infraestrutura, Resiliência e Automação Cloud.
- **Skill Atribuída**: `infra-devops`.
- **Responsabilidades**:
  - Configurar contêineres Docker, scripts de build, pipelines de CI/CD e rotinas de backup S3.
  - Garantir observabilidade via LangSmith e integridade dos snapshots remotos.
  - Monitorar a saúde dos processos em background e circuit breakers do Bridge Daemon.
