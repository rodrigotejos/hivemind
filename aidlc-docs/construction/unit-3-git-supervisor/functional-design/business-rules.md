# Business Rules - Unit 3: Git Supervisor & Commit Approval

## 1. Rule Catalog

| Rule ID | Nome | Categoria | Gravidade | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| **BR-GIT-01** | Diff Não Vazio | Validação | Impeditiva | O endpoint de commit deve rejeitar qualquer solicitação caso o `git status --porcelain` retorne vazio ou não haja modificações reais a comitar. |
| **BR-GIT-02** | Prevenção de Shell Injection | Segurança | Bloqueante | O comando Git não deve concatenar strings de usuário em shells. A execução deve utilizar `execFile` com argumentos atômicos, sanitizando caracteres nulos e delimitadores perigosos. |
| **BR-GIT-03** | Bloqueio de Arquivos Sensíveis | Segurança | Bloqueante | Arquivos contendo segredos, certificados, chaves privadas ou variáveis de ambiente (`.env*`, `*.pem`, `*.key`, `id_rsa*`, etc.) bloqueiam imediatamente o commit com erro `403 Forbidden (SENSITIVE_FILE_VIOLATION)`. |
| **BR-GIT-04** | Backup Resiliente em Rejeição | Resiliência | Mandatória | Ao rejeitar modificações, o sistema é proibido de executar `git reset` sem antes gravar as alterações em uma branch de backup temporária (`backup/rejected-<timestamp>`), prevenindo perda de trabalho. |
| **BR-GIT-05** | Formato Conventional Commits | Governança | Informativa | A sugestão gerada pela IA deve seguir a especificação semântica Conventional Commits (`feat(...)`, `fix(...)`, etc.). O operador humano pode editar livremente a mensagem. |
| **BR-GIT-06** | Registro de Auditoria | Governança | Mandatória | Toda ação humana de aprovação ou rejeição de commit deve registrar no banco de dados e no log de auditoria o autor, hash do commit ou branch de backup, e data/hora exata. |

---

## 2. Rule Specifications

### 2.1 BR-GIT-02: Execução Segura via `execFile`
```typescript
// PROIBIDO (Inseguro - vulnerável a command injection via interpolação de string):
// exec(`git commit -m "${message}"`)

// OBRIGATÓRIO (Seguro - argumentos atômicos sem interpretação de shell):
import { execFile } from 'child_process';
import util from 'util';
const execFilePromise = util.promisify(execFile);

await execFilePromise('git', ['commit', '-m', sanitizedMessage], { cwd: workingDir });
```

### 2.2 BR-GIT-03: Padrões de Arquivos Sensíveis Bloqueados
```typescript
export const BLOCKED_PATTERNS: RegExp[] = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /id_rsa/i,
  /credentials\.json$/i,
  /secrets?\.(json|yaml|yml)/i,
];
```

### 2.3 BR-GIT-04: Estratégia de Backup Resiliente
```bash
# 1. Salvar o estado em branch de backup
git checkout -b backup/rejected-$(date +%s)
git add .
git commit -m "chore(backup): rejected changes by operator"

# 2. Retornar à branch de trabalho
git checkout main

# 3. Limpar a working tree
git reset --hard HEAD
git clean -fd
```
