# Hivemind — AI-DLC (AI Development Lifecycle Coordinator)

O **AI-DLC** é um orquestrador projetado para gerenciar a comunicação e colaboração de múltiplos agentes de Inteligência Artificial e humanos trabalhando em projetos de código. 

O sistema expõe uma API REST/WebSockets para os agentes enviarem logs e mensagens, enquanto o humano acompanha o progresso e responde a impedimentos através de um Dashboard em tempo real.

---

## 🚀 Como Iniciar e Usar

Siga os comandos abaixo a partir da raiz do repositório:

### 1. Instalar as Dependências
Instala todos os pacotes dos workspaces do monorepo (SDK, Server e Web):
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Certifique-se de que os arquivos `.env` na raiz e em `packages/server/` possuam a chave de API do Google configurada:
```env
PORT=3001
NODE_ENV=development
GOOGLE_API_KEY=sua_chave_aqui
```

### 3. Compilar os Workspaces
Compila o código TypeScript em todos os pacotes:
```bash
npm run build
```

### 4. Rodar o Servidor de Desenvolvimento
Inicia concorrentemente o SDK, o servidor backend (na porta `3001`) e o painel frontend web (na porta `5173`):
```bash
npm run dev
```

---

## 🛠️ Scripts Úteis (Comandos Adicionais)

* **Iniciar Projeto Limpo (`dashboard-bi`)**:
  Limpa todas as simulações e registros do banco de dados SQLite e inicializa um workspace vazio do `dashboard-bi` com apenas você (`rodrigo`) vinculado:
  ```bash
  node clean-bi.js
  ```
  *(Recomendado para quando for conectar os seus agentes de chat reais)*

* **Executar Simulação de Teste**:
  Limpa o banco e roda um fluxo realista de mensagens simuladas entre 3 IAs (`Alpha`, `Beta`, `Gama`) e o humano:
  ```bash
  node simulate-bi.js
  ```

---

## 💬 Integração com Seus Agentes Externos

Se você tiver agentes externos em execução e quiser conectá-los a este ecossistema para que eles atualizem o "Super Resumo" e troquem mensagens:

* 📄 **Prompt de Referência**: O prompt que você deve copiar e injetar nas suas IAs está salvo no arquivo [agent-delegation-prompt.md](./agent-delegation-prompt.md).
* **ID do Projeto**: O ID do projeto gerado pode ser consultado após rodar o comando `clean-bi.js` e deve ser configurado no prompt do agente.

---

## 📁 Registro de Alterações e Contexto

Todas as alterações estruturais, logs de desenvolvimento e histórico de correções estão documentados de forma contínua no arquivo [.gemini](./.gemini) para manter a memória do projeto.
