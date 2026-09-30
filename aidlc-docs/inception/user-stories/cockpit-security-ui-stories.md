# User Stories: Cockpit Security UI, Status & Wiki Overhaul (Iteration 3)

## Personas
- **Rodrigo (Tech Lead / Engenheiro Humano)**: Responsável pela supervisão arquitetural e de segurança do projeto. Precisa de métricas confiáveis e transparentes no Cockpit, sem números artificiais ou atrasos de carregamento.
- **Delta Security (Auditor Red Team)**: Agente autônomo focado em encontrar vulnerabilidades e reportar o progresso em etapas claras.
- **Beta Backend / Alpha Frontend (Blue Team)**: Agentes focados na mitigação e verificação das defesas do código.

---

## US-9: Persistência Real do Security Score no Banco de Dados
**Como** Tech Lead gerenciando projetos no Cockpit,  
**Quero** que o Score de Segurança e sua classificação venham diretamente do banco de dados ao abrir o projeto,  
**Para que** eu veja a pontuação real imediatamente e nunca um falso "100%" ou valores genéricos antes da auditoria.

### Acceptance Criteria
- **Scenario 1: Projeto com auditoria prévia gravada**
  - **Given** que o projeto possui `security_score = 75` e `security_rating = 'B'` persistidos no SQLite
  - **When** o usuário acessa a página do projeto ou dá refresh
  - **Then** `GET /api/projects/:id` já retorna `security_score: 75` e `security_rating: 'B'`
  - **And** o Cockpit exibe imediatamente `75/100 B` sem exibir `100/100` em nenhum momento transitório.

- **Scenario 2: Projeto novo sem auditoria**
  - **Given** que o projeto foi criado recentemente e ainda não possui auditorias
  - **When** a página do projeto é carregada
  - **Then** o Cockpit exibe `-- / 100` com badge neutro e tooltip "Auditoria Pendente".

---

## US-10: Painel de Governança & Operações de Segurança (Sem Caixa de Texto)
**Como** operador do Cockpit,  
**Quero** um painel focado em governança com seletores e gatilhos de segurança diretos,  
**Para que** eu não confunda essa tela com o terminal de chat (que fica no Terminal do Projeto).

### Acceptance Criteria
- **Scenario 1: Ausência de input de digitação**
  - **Given** que o usuário está no Cockpit do projeto
  - **Then** não deve existir o campo de texto `Ex: Criar tela do Figma, rota backend e testes PBT...`
  - **And** todas as interações livres por texto continuam disponíveis em `/projects/:id/messages`.

- **Scenario 2: Disparo de auditoria e conformidade**
  - **Given** que o usuário selecionou o modelo e nível de raciocínio desejados
  - **When** o usuário clica em "Disparar Auditoria Adversarial"
  - **Then** o backend inicia o pipeline de segurança e o botão entra em estado animado de execução.

---

## US-11: Pipeline de 5 Fases Determinísticas & Live Ticker de Segurança
**Como** Tech Lead observando a execução dos agentes de segurança,  
**Quero** acompanhar o progresso em 5 fases bem definidas com um ticker do arquivo/ação sendo auditada,  
**Para que** eu compreenda exatamente o que o Red Team e Blue Team estão inspecionando a cada instante.

### Acceptance Criteria
- **Scenario 1: Fases Determinísticas e Emissão Socket.IO**
  - **Given** que a auditoria está em andamento
  - **When** o orquestrador transita entre as fases (1. Rotas/CORS ➔ 2. Segredos ➔ 3. Red Team ➔ 4. Blue Team ➔ 5. Gravação no DB)
  - **Then** eventos `security_phase_progress` são emitidos com `{ phase, totalPhases, phaseName, currentCheck }`
  - **And** a UI avança a barra de etapas (ex: `Fase 3 de 5`) e o ticker exibe a checagem ativa em tempo real.

- **Scenario 2: Conclusão e Gravação Atômica**
  - **Given** que a fase 5 é concluída
  - **When** os achados e pontuações finais são calculados
  - **Then** `projects.security_score` e `projects.last_security_audit_at` são atualizados no SQLite
  - **And** o status transita para "✓ Auditoria Concluída".

---

## US-12: Wiki Técnica com Scroll Controlado & Busca Textual
**Como** desenvolvedor consultando o Executive Summary e Wiki Técnica do projeto,  
**Quero** uma área delimitada com rolagem suave e um campo de busca simples no cabeçalho,  
**Para que** eu encontre endpoints, decisões ou testes rapidamente sem rolar uma página gigantesca.

### Acceptance Criteria
- **Scenario 1: Delimitação de Altura**
  - **Given** que a Wiki possui centenas de linhas de markdown
  - **Then** o card possui altura máxima de `550px` com `overflow-y-auto` e scrollbar escura estilizada.

- **Scenario 2: Busca e Realce de Termos**
  - **Given** que o usuário digita "PBT" ou "geocode" no campo de busca da Wiki
  - **Then** o contador exibe o número de ocorrências encontradas
  - **And** os termos coincidentes no texto são destacados visualmente com tag de highlight.
