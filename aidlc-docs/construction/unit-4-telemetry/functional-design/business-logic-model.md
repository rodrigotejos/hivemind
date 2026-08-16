# Unit 4 Functional Design: LangSmith Observability & Token Telemetry

## 1. Telemetry Domain & Data Models

### 1.1 `ProjectTelemetry`
- `projectId`: ID do projeto monitorado.
- `totalTokens`: Soma de prompt + completion tokens consumidos.
- `estimatedCostUsd`: Estimativa de custo baseada na tabela de preços dos modelos ($0.075 / 1M prompt tokens para Gemini Flash, etc.).
- `runsCount`: Total de execuções de grafos e agentes.
- `activeAgents`: Lista de agentes que emitiram spans.
- `spans`: Lista de eventos detalhados com timestamps, duração e tokens.

### 1.2 Integração Híbrida LangSmith & Fallback Local
- Quando `LANGSMITH_API_KEY` ou `LANGCHAIN_API_KEY` estiver configurada, o `TelemetryService` envia traces completos via SDK oficial da LangSmith.
- Quando as credenciais não estiverem configuradas ou em ambiente offline, o serviço armazena métricas e contabilidade de tokens no banco SQLite local, garantindo que o Web Dashboard sempre exiba gráficos e métricas precisas.
