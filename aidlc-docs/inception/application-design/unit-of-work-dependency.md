# Unit of Work Dependency Matrix & Execution Sequence

## 1. Unit Dependency Matrix

| Unidade | Nome | Depende De | Pode Executar em Paralelo Com |
|---|---|---|---|
| **`UOW-01`** | SDK Models & Skills Catalog | Nenhuma (Fundação) | — |
| **`UOW-02`** | LangGraph State Machine & Supervisor | `UOW-01` | `UOW-04`, `UOW-05` |
| **`UOW-03`** | Antigravity Bridge Daemon | `UOW-01`, `UOW-02` | `UOW-04`, `UOW-05` |
| **`UOW-04`** | LangSmith Observability & Telemetry | `UOW-01` | `UOW-02`, `UOW-03`, `UOW-05` |
| **`UOW-05`** | Project Auto-Setup & S3 Backup | `UOW-01` | `UOW-02`, `UOW-03`, `UOW-04` |
| **`UOW-06`** | Cockpit HITL Web Dashboard | `UOW-01`, `UOW-02`, `UOW-03`, `UOW-04` | — |

---

## 2. Construction Execution Sequence

```mermaid
flowchart TD
    U1["📦 UOW-01: SDK Models & Skills Catalog<br/>(Foundational)"]
    
    U2["🧠 UOW-02: LangGraph State Machine"]
    U4["📊 UOW-04: LangSmith Telemetry"]
    U5["🚀 UOW-05: Auto-Setup & S3 Backup"]
    
    U3["⚡ UOW-03: Bridge Daemon (agy Runner)"]
    
    U6["🖥️ UOW-06: Cockpit HITL Web Dashboard"]
    
    TEST["🧪 Integration & PBT Test Suite"]

    U1 --> U2
    U1 --> U4
    U1 --> U5
    U2 --> U3
    U3 --> U6
    U4 --> U6
    U5 --> U6
    U6 --> TEST

    style U1 fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style U2 fill:#2196F3,stroke:#0D47A1,stroke-width:3px,color:#fff
    style U3 fill:#2196F3,stroke:#0D47A1,stroke-width:3px,color:#fff
    style U4 fill:#2196F3,stroke:#0D47A1,stroke-width:3px,color:#fff
    style U5 fill:#2196F3,stroke:#0D47A1,stroke-width:3px,color:#fff
    style U6 fill:#FF9800,stroke:#E65100,stroke-width:3px,color:#000
    style TEST fill:#9C27B0,stroke:#4A148C,stroke-width:3px,color:#fff
```
