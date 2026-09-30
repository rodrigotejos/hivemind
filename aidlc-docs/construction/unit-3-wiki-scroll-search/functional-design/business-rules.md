# Business Rules: Unit 3 - Wiki Técnica com Scroll Delimitado & Busca

## BR-01: Sanitização de Expressão Regular (Security Baseline)
* **Regra**: O valor digitado no campo de busca NÃO DEVE quebrar a compilação de `RegExp` (evitando erro de sintaxe com parênteses desbalanceados, barras invertidas ou colchetes).
* **Mitigação**: Todo caractere reservado em RegExp deve ser estritamente escapado com `\\$&` antes de instanciar a expressão de busca.

## BR-02: Preservação Integral de Conteúdo Original
* **Regra**: A aplicação de realce visual NÃO PODE corromper, omitir ou truncar nenhum caractere do texto original da Wiki técnica.
* **Invariante PBT**:
  $$\forall \text{ texto } T, \forall \text{ query } Q, \quad \text{stripHighlight}(\text{highlight}(T, Q)) \equiv T$$

## BR-03: Scroll Delimitado e Altura Máxima
* **Regra**: O container de leitura da Wiki técnica deve ter altura máxima finita (`max-h-[550px]`) com `overflow-y-auto` e scrollbar customizada com contraste adequado.
* A página principal do Cockpit nunca deve esticar infinitamente na vertical devido ao tamanho da Wiki técnica.
