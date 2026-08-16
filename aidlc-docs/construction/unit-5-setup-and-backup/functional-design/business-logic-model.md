# Unit 5 Functional Design: Project Auto-Setup & Cloud S3 Snapshot Resilience

## 1. Project Setup Assistant Architecture

### 1.1 Verificação de Integridade de Repositório
O `ProjectSetupService` varre o caminho de um repositório especificado e verifica a existência de:
- `.aidlc/aidlc-rules/`
- `.agent/rules/ai-dlc.md`
- `.agent/skills/`
- `AGENTS.md`
- `.kiro/steering/ai-dlc.md`

Se algum arquivo/diretório estiver ausente, o método `bootstrapProject` gera os arquivos a partir dos templates canônicos e adiciona `.aidlc/` ao `.gitignore` automaticamente.

---

## 2. Cloud Snapshot & S3 Resilience Architecture

### 2.1 Estrutura do Snapshot
Um snapshot encapsula todo o estado persistido do projeto:
- Dump das tabelas SQLite (`projects`, `agents`, `messages`, `decisions`, `notifications`, `langgraph_checkpoints`).
- Hash criptográfico SHA-256 gerado a partir do payload canônico.
- Upload/Download seguro para Amazon S3 (ou armazenamento persistente local quando sem credenciais AWS).
- Restauração transacional com integridade referencial mantida.
