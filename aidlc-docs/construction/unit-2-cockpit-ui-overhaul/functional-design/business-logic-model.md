# Business Logic Model: Unit 2 - Cockpit UI Overhaul & Expressive Status

## 1. Governance Panel Interaction Flow

```mermaid
flowchart TD
    User["Operador no Cockpit"] --> Config["Seleciona Modelo & Raciocínio"]
    Config --> Trigger["Clica 'Disparar Auditoria Adversarial'"]
    Trigger --> LoadingState["Botão entra em estado 'Auditando Código...'"]
    Trigger --> API["POST /api/projects/:id/security/scan"]
    
    API --> SocketStream["Socket.IO escuta 'security_phase_progress'"]
    
    subgraph StepperUI ["Pipeline Stepper & Live Ticker"]
        S1["Fase 1: Mapeamento Rotas & CORS"] --> S2["Fase 2: Varredura Segredos .env"]
        S2 --> S3["Fase 3: Simulação Red Team"]
        S3 --> S4["Fase 4: Mitigações Blue Team"]
        S4 --> S5["Fase 5: Gravação SQLite & Score Real"]
    end

    SocketStream --> StepperUI
    S5 --> ScoreUpdate["Atualiza Topbar Red vs Blue Score (ex: 75/100 B)"]
    S5 --> StatusDone["Status: ✓ Auditoria Concluída"]
```

---

## 2. Dynamic Live Ticker Logic
O ticker exibe dinamicamente:
* **Fase Ativa**: `Fase X de 5` acompanhado de barra de progresso visual de 5 segmentos com gradiente esmeralda/índigo.
* **Agente e Ação**:
  * Em execução: `[Nome do Agente] targetFile: currentCheck` com ponto pulsante âmbar/ciano.
  * Concluído: `✓ Auditoria Concluída: Score persistido no banco` com ponto verde fixo.
  * Idle: `Pronto para Auditoria Adversarial` com ponto cinza.
