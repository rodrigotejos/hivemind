# Unit of Work Story Map

Abaixo segue o mapeamento de cada história de usuário validada na fase anterior (User Stories) para a respectiva Unidade de Trabalho que deverá implementá-la no backend e frontend simultaneamente.

## Unit 1: Infraestrutura de LLM & Segurança
| Story ID | Título | Justificativa |
| :--- | :--- | :--- |
| **US-5** | Structured Output e Prevenção de Injeção | Core da segurança LLM. Substitui o parse Regex falho. |
| **US-6** | Sliding Window de Tokens | Otimização da infra antes que a UI faça requisições pesadas. |
| **US-7** | Desacoplamento de Prompts | Necessário para hot-reload sem reiniciar o Node local. |
| **US-8** | Resiliência Assíncrona do Daemon | Modifica os tempos de expiração fundamentais do worker. |

## Unit 2: Cockpit Streaming & Auto-Recovery UI
| Story ID | Título | Justificativa |
| :--- | :--- | :--- |
| **US-1** | Feedback de Raciocínio (Thinking & Typing) | Exige o LLM estável da Unit 1 para streamar tokens ao front. |
| **US-2** | Notificação de Retentativa | Cria o fluxo de fallback entre SocketGateway e Front React. |
| **US-3** | Falha Crítica Pós-Retentativas | Bloqueio final de interface caso o retry esgote. |

## Unit 3: Git Supervisor & Commit Approval
| Story ID | Título | Justificativa |
| :--- | :--- | :--- |
| **US-4** | Aprovação Interativa de Commit | A feature de UX final que usa os Sockets (Unit 2) para renderizar um modelo de Diff na tela. |
