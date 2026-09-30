# Story Generation Plan: Iteration 4 - Persistent Security Run State & Universal Stepper

## Methodology and Approach
Adotaremos a abordagem **Feature-Based & User-Journey Driven**, focada na jornada do Líder Técnico / Operador de Segurança ao executar, monitorar, alternar abas ou recarregar a aplicação web durante e após a execução do pipeline de segurança.

---

## Execution Checklist

- [ ] 1. Definir/atualizar `personas.md` com arquétipos de usuário (Líder Técnico de Engenharia / Operador de Segurança).
- [ ] 2. Gerar histórias de usuário em `stories.md` seguindo rigorosamente os critérios INVEST:
  - **US-13**: Persistência de Execução de Segurança em `security_runs` no SQLite (ID do Run, Fase $1..5$, Agente, Timestamps e Status).
  - **US-14**: Resiliência e Re-hidratação de Estado após Page Refresh (F5) ou Troca de Abas.
  - **US-15**: Bloqueio de Auditorias Concorrentes & Idempotência por Banco (Trava contra múltiplos disparos simultâneos).
  - **US-16**: Stepper Universal de 5 Fases no `SecurityAuditPanel` com Ticker Dinâmico ao Vivo.
- [ ] 3. Escrever critérios de aceitação detalhados em formato Gherkin (Given/When/Then) para cada história.
- [ ] 4. Mapear as personas para as histórias de usuário correspondentes.

---

## Clarification Questions & Verified Approach

### Question 1: Resolução de Concorrência se o Usuário Disparar Scan com Outro em Andamento
Como o sistema deve se comportar se uma requisição tentar iniciar um scan enquanto outro já está em execução?

- A) (Recomendado) Rejeitar a API com HTTP 409 Conflict informando o `run_id` e fase ativa, e desabilitar visualmente os botões no frontend com tooltip/aviso de scan em andamento.
- B) Enfileirar a nova solicitação silenciosamente para execução posterior.
- X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: Comportamento do Stepper ao Concluir a Auditoria
Após a Fase 5 ser gravada no SQLite com sucesso:

- A) (Recomendado) O Stepper permanece visível mostrando todas as 5 fases verdes ("Concluído 100%"), permitindo que um novo scan seja disparado quando o usuário desejar.
- B) O Stepper é resetado imediatamente para "Pronto" sem indicar a conclusão da última execução.
- X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: Preservação dos Agentes do LangGraph
Como o runtime dos agentes deve ser mantido durante os scans?

- A) (Recomendado) O pipeline de segurança executa como serviço autônomo desacoplado do loop de chat, sem resetar conexões, sessões ou mensagens existentes dos agentes do projeto.
- B) O scan reinicia o grafo LangGraph a cada nova execução.
- X) Other (please describe after [Answer]: tag below)

[Answer]: A
