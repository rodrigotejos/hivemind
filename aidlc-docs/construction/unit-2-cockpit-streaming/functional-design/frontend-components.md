# Frontend Components Design - Unit 2: Cockpit Streaming & Auto-Recovery UI

## 1. Component Hierarchy & Layout

```
MessagesView (Página Principal)
├── Header & Sessions Tabs
├── Chat Area
│   ├── MessageBubble (Mensagens persistidas do SQLite)
│   └── TypingStreamBubble (Stream ativo em tempo real com cursor '▋' pulsante)
├── Floating Recovery Stack (`top-4 right-4 z-50`)
│   └── RecoveryToast (Alerta não-intrusivo de retry com barra de progresso)
└── CockpitPanel (Sidebar de Orquestração com status do Grafo e Telemetria)
```

---

## 2. Component Specifications

### 2.1 `RecoveryToast.tsx` (`packages/web/src/components/RecoveryToast.tsx`)
- **Props**:
  ```typescript
  export interface RecoveryToastProps {
    toast: {
      id: string;
      agentId: string;
      agentRole: string;
      status: 'retrying' | 'recovered' | 'exhausted';
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      errorMessage: string;
    };
    onDismiss: (id: string) => void;
  }
  ```
- **Visual Design**:
  - Posição flutuante no canto superior direito (`fixed top-4 right-4 flex flex-col gap-2 z-50 pointer-events-auto`).
  - Container Dark Glassmorphism: `bg-zinc-950/95 border border-amber-500/30 shadow-2xl backdrop-blur-xl rounded-xl p-3.5 max-w-sm`.
  - Cabeçalho: Ícone de alerta animado (`RefreshCw animate-spin` ou `AlertTriangle`), nome do agente em destaque (`text-amber-400 font-semibold`) e botão de fechar `X`.
  - Corpo: Texto explicativo `Rate limit / Timeout detectado. Retentando em breve...`
  - Barra de Progresso Regressiva: `div` com transição linear CSS `transition-all` do width de 100% a 0% durante `delayMs`.
  - Estado `recovered`: Borda verde esmeralda `border-emerald-500/40`, ícone `CheckCircle text-emerald-400` e mensagem `✓ Conexão com LLM restabelecida!`. Auto-dismiss em 3 segundos.

### 2.2 `TypingStreamBubble` (dentro de `MessagesView.tsx`)
- **Visual Design**:
  - Balão do agente ativo com borda destacada em azul/índigo (`border-indigo-500/40 bg-zinc-900/60`).
  - Cabeçalho: Badge animado `Digitando...` com 3 pontos piscantes.
  - Texto: Markdown ou texto cumulativo recebido via deltas de socket.
  - Cursor: Elemento `span` inline com caractere `▋` ou bloco vertical piscante (`animate-pulse text-indigo-400 font-mono ml-0.5`).
  - Transição de Saída: Quando o evento `agent_step_finished` é acionado, o cursor é ocultado e a mensagem oficial do backend assume o lugar instantaneamente sem piscar a tela.

---

## 3. Integração com WebSockets (`MessagesView.tsx`)

| Evento Socket.IO | Efeito no Estado do React |
| :--- | :--- |
| `agent_step_started` | Marca agente como `status: 'thinking'`. |
| `agent_typing` | Cria ou atualiza a entrada correspondente no dicionário `activeStreams`. |
| `agent_recovery` | Se `status === 'retrying'`, insere ou atualiza o toast no array `recoveryToasts`. Se `status === 'recovered'`, marca toast como recuperado com timer de remoção. Se `status === 'exhausted'`, marca toast com cor vermelha de falha crítica e abre modal. |
| `agent_step_finished` | Remove a mensagem do `activeStreams` com delay suave para renderizar a mensagem persistida. |
