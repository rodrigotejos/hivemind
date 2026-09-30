# Business Rules: Unit 2 - Universal Stepper, Re-hidratação Pós-Refresh & Lockout Visual

## Regras de Negócio do Cliente (Frontend)

### BR-06: Visibilidade Universal e Independência de Abas
- O componente de 5 etapas do pipeline de segurança deve estar **permanentemente visível** dentro de `SecurityAuditPanel`, antes, durante e após a execução.
- O fato do card de governança superior estar oculto na aba de segurança (`hideSecurityCard={true}`) não pode impedir o operador de acompanhar o roteiro de fases e o status da auditoria.

### BR-07: Re-hidratação Atômica Pós-Refresh (F5) e Navegação
- Ao montar o componente (`useEffect`), o frontend deve requisitar `GET /api/projects/:projectId/security/run-status`.
- Se o backend reportar um run com `status === 'running'`:
  1. O estado local `scanning` (ou `isScanning`) deve ser imediatamente marcado como `true`.
  2. O `phaseProgress` deve ser inicializado com a fase exata gravada no SQLite (ex.: Fase 3).
  3. O socket deve ser conectado e aguardar os próximos eventos da Fase 4 e 5.
- Se o backend reportar `status === 'completed'`:
  1. O stepper deve ser renderizado com as 5 etapas preenchidas em verde ("100% Concluído").
  2. O ticker deve exibir o score persistido e a marcação de sucesso.
- O estado "Pronto para Auditoria" só pode ser exibido se não houver nenhum run prévio no banco ou se o último run não contiver dados de fase.

### BR-08: Eliminação de Delays Artificiais e Timers Fictícios
- É estritamente proibido o uso de `setTimeout` fixo no frontend para simular ou encerrar auditorias (ex.: eliminação do legado `setTimeout(3000)`).
- O estado de execução só pode transicionar para concluído (`completed`) quando:
  1. O evento `security_phase_progress` com `status: 'completed'` for emitido pelo servidor, ou
  2. O endpoint `/run-status` retornar `status === 'completed'`.
- Na conclusão, `fetchSecurityData()` deve ser chamado para recarregar o resumo, findings e score consolidados.

### BR-09: Bloqueio Concorrente Visual (Lockout Idempotente)
- Enquanto qualquer scan estiver em andamento (`scanning === true` ou `phaseProgress?.status === 'running'`), todos os botões de disparo de scan no frontend ("Disparar Scan Red Team" e "Disparar Auditoria Adversarial") devem ser desabilitados (`disabled={true}`).
- O texto do botão deve mudar para "Auditando Código..." com spinner giratório (`animate-spin`), prevenindo cliques duplicados pelo operador.

### BR-10: Tratamento Resiliente de Conflito (HTTP 409 Conflict)
- Caso o usuário acione o disparo enquanto outro cliente ou aba estiver executando um scan, a requisição `POST /scan` retornará `HTTP 409 Conflict`.
- O cliente deve interceptar o código 409, extrair o payload `{ error: 'SCAN_ALREADY_RUNNING', activeRun }`, atualizar o `phaseProgress` local com o `activeRun` e travar a interface sem lançar alertas de erro genéricos.
