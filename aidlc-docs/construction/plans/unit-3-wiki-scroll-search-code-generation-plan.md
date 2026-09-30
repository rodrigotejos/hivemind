# Code Generation Plan: Unit 3 - Wiki Técnica com Scroll Delimitado & Busca

## Unit Context & Stories
- **Unit Name**: `unit-3-wiki-scroll-search`
- **Stories Covered**: US-12 (Wiki Técnica com Scroll Controlado & Busca Textual)
- **Target Package**: `packages/web`
- **Single Source of Truth**: Este documento é o plano executivo para a geração de código da Unit 3.

---

## Detailed Implementation Steps

- [x] **Step 1: ProjectView Wiki Search & Highlighting Implementation**
  - **Files**: `packages/web/src/pages/ProjectView.tsx`
  - **Action**:
    - Adicionar estado `wikiSearchQuery`.
    - No cabeçalho da Wiki Técnica, incluir o input de busca com ícone de `Search`, botão de limpeza `X` e badge dinâmico com contagem total de correspondências encontradas.
    - Delimitar o container de leitura com `max-h-[550px] overflow-y-auto pr-3 custom-scrollbar`.
    - Implementar a função de renderização com realce `<mark>` seguro para os termos correspondentes.
  - **Story**: US-12

- [x] **Step 2: Custom Scrollbar Styling**
  - **Files**: `packages/web/src/index.css`
  - **Action**: Adicionar classe utilitária `.custom-scrollbar` para barra de rolagem sutil, escura e moderna com contraste adequado no tema escuro.
  - **Story**: US-12

- [x] **Step 3: PBT Invariants Test for Search & Highlighting**
  - **Files**: `packages/server/tests/pbt/unit-3-wiki-invariants.test.ts`
  - **Action**: Validar invariante com `fast-check`:
    - Invariante 1: Sanitização estrita contra quebra de RegExp para quaisquer strings arbitrárias contendo caracteres especiais (`.*+?^${}()|[]\`).
    - Invariante 2: Preservação de integridade de 100% dos caracteres originais após aplicação e remoção de highlights.
  - **Story**: US-12

- [x] **Step 4: Frontend Build & Typecheck**
  - **Action**: Executar `npm run build -w web` para verificar compilação TypeScript e empacotamento Vite sem erros.

- [x] **Step 5: Code Generation Documentation & Summary**
  - **Files**: `aidlc-docs/construction/unit-3-wiki-scroll-search/code/unit-3-summary.md`
  - **Action**: Documentar os arquivos modificados, classes e testes da Unit 3.
