# Functional Design Plan - Unit 1: Infraestrutura de LLM & Segurança

## Objective
Projetar em nível de detalhe lógico, agnóstico de infraestrutura, os algoritmos e regras de negócio para:
- Structured Output nativo e validação de schema (US-5)
- Cálculo e poda inteligente de contexto via Sliding Window de Tokens (US-6)
- Sistema desacoplado de Prompts em Markdown com interpolação segura (US-7)
- Resiliência e modelo assíncrono com heartbeats para o bridge-daemon (US-8)
- Invariantes de teste baseado em propriedades (PBT) e controles de segurança (Security Baseline)

## Execution Checklist
- [x] 1. Read the approved answers from the embedded questions in this plan.
- [x] 2. Generate `business-logic-model.md` detalhando os fluxos algorítmicos e máquinas de estado.
- [x] 3. Generate `business-rules.md` detalhando regras de validação, limites, retries e políticas de segurança.
- [x] 4. Generate `domain-entities.md` detalhando as estruturas de dados, schemas Zod, entidades e tipos de payload.
- [x] 5. Incorporar propriedades invariantes para Property-Based Testing (PBT) e requisitos de Resiliency/Security Baseline.

---

## Clarification Questions

### Question 1: Algoritmo de Sliding Window de Tokens (US-6)
Quando o histórico de mensagens exceder o orçamento de tokens definido (ex: 80% da janela de contexto):
A) Preservar a mensagem de Sistema inicial + a primeira mensagem de contexto do projeto, e selecionar as mensagens subsequentes do fim para o início até atingir o limite (janela deslizante com âncora inicial).
B) Cortar estritamente do início para o fim mantendo apenas as mensagens mais recentes (poda puramente cronológica reversa).
C) Executar uma chamada recursiva de sumarização automática para condensar as mensagens antigas em um único bloco de resumo antes de anexar as recentes.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 2: Formato e Interpolação dos Prompts em Markdown (US-7)
Para desacoplar os prompts do código em arquivos `.md` (em `packages/server/prompts/`):
A) Arquivos Markdown com cabeçalho YAML Frontmatter (metadados como `role`, `modelTarget`, `temperature`) e placeholders `${variavel}` com sanitização de injeção.
B) Arquivos Markdown puros sem frontmatter, utilizando apenas interpolação de tags estilo `{variavel}`.
C) Arquivos JSON contendo arrays de mensagens por role com templates de string.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 3: Validação do Structured Output e Recuperação (US-5)
Se a resposta da LLM violar o JSON Schema ou falhar na validação Zod:
A) Realizar até 2 tentativas automáticas enviando o erro de validação de volta à LLM para autocorreção (Reflection Loop) antes de lançar erro estruturado.
B) Lançar erro imediatamente e acionar o fallback estático seguro com notificação de falha estruturada.
C) Tentar um parser relaxado (JSON repair) e, se ainda inválido, lançar exceção.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 4: Modelo de Heartbeat e Timeout do Daemon (US-8)
Para substituir o timeout estático rígido de 300000ms no processamento assíncrono:
A) Adotar um modelo de Heartbeat com lease renovável (ex: heartbeat a cada 10s, timeout disparado apenas se passar 60s sem nenhum heartbeat do subprocesso).
B) Remover totalmente qualquer timeout e confiar exclusivamente no evento de término do processo filho do sistema operacional.
C) Manter um timeout configurável por tipo de tarefa (ex: QA = 10 min, Red Team = 30 min) com polling periódico.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

