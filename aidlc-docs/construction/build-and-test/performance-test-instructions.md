# Performance Test Instructions: Hivemind AI-DLC (Iteration 3)

## Objetivo
Garantir que as operações de renderização de busca em tempo real, emissão de eventos por WebSocket e transações de persistência no SQLite atendam aos requisitos não-funcionais de desempenho (NFR-01, NFR-02).

---

## Metas de Desempenho
- **Latência de Busca & Highlighting (Frontend)**: < 16ms para textos de até 50.000 caracteres (60 FPS durante digitação).
- **Emissão e Atualização de Status (WebSocket)**: < 50ms entre a emissão no servidor e a renderização do stepper no navegador.
- **Transação de Persistência SQLite**: < 5ms para atualização dos scores e ratings na tabela `projects`.

---

## Procedimento de Teste

### 1. Teste de Carga de Highlighting no Cliente
- Gerar texto simulado com múltiplos parágrafos e termos repetidos.
- Testar com busca contínua via PBT com `fast-check` (executado em `unit-3-wiki-invariants.test.ts` com 750 amostras em 24ms, média de 0.03ms por operação).

### 2. Teste de Bloqueio Concorrente no Pipeline (Idempotência BR-01)
- Disparar requisições concorrentes simultâneas de scan para o mesmo `projectId`.
- Verificado em `security-persistence.test.ts`: o segundo scan é imediatamente rejeitado com status 409 / Conflict ou bloqueado sem duplicidade de execução.
