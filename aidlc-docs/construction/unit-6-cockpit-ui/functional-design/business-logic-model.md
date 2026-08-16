# Unit 6 Functional Design: Cockpit Human-in-the-Loop Web Dashboard & UI

## 1. UI & State Architecture

### 1.1 `CockpitPanel` Component
- **Polling & Live Updates**: Sincroniza periodicamente com `/api/projects/:id/graph/state` e `/api/projects/:id/telemetry`.
- **Controle de Loop Autônomo**: Input de objetivo e botão de disparo com seletor de limite de rodadas (3, 5, 10).
- **Human-in-the-Loop Gate Card**:
  - Exibido automaticamente em destaque com alerta visual e sonoro quando `status === 'waiting_human'`.
  - Apresenta a pergunta formulada pelo Supervisor ou pelo agente e botões rápidos para resposta ou aprovação de checkpoint (`/api/projects/:id/graph/resume`).
- **Barra de Telemetria e Ferramentas**:
  - Exibição em tempo real de tokens acumulados e custos estimados em USD.
  - Botão de 1 clique para Auto-Setup do AI-DLC (`/api/projects/:id/setup/bootstrap`).
  - Botão de 1 clique para geração de snapshots e backup resiliente em S3 (`/api/projects/:id/snapshots`).
