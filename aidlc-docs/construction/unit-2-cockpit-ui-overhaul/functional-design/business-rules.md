# Business Rules: Unit 2 - Cockpit UI Overhaul & Expressive Status

## BR-01: Proibição de Falso Score Inicial (Zero False Positives)
* **Regra**: O frontend NUNCA deve exibir `100/100 A+` como fallback para dados ainda não carregados ou projetos sem auditoria prévia.
* **Comportamento**:
  * Se `project.security_score` for `null` ou `undefined`, exibir `-- / 100` e badge neutro "Sem Auditoria".
  * Se `project.security_score` for um número, exibir `${project.security_score}/100` e a respectiva letra persistida.

## BR-02: Eliminação do Input de Texto Redundante
* **Regra**: Não deve existir nenhum `<input type="text">` de instrução conversacional livre no card de coordenação do Cockpit.
* **Comportamento**: Toda interação conversacional é encaminhada para o link "Terminal do Projeto" (`/projects/:id/messages`), eliminando duplicação de canais.

## BR-03: Rótulo e Cálculo Verdadeiro no Card de Mitigações
* **Regra**: O Card 4 de estatísticas da auditoria deve calcular a porcentagem real de verificações em relação às mitigações, eliminando o texto estático "100% Verificadas".
* **Fórmula**:
  $$\text{total} = \text{verified} + \text{mitigated}$$
  $$\text{percentual} = \text{total} > 0 ? \text{round}\left(\frac{\text{verified}}{\text{total}} \times 100\right) : 0$$
* O título do card DEVE ser "Mitigações Verificadas" e o badge exibe `${percentual}% (${verified}/${total})`.
