const API_URL = 'http://localhost:3001/api';
const HUMAN_ID = 'rodrigo';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  if (res.status !== 204 && res.headers.get('content-length') !== '0') {
    try { return await res.json(); } catch (e) {}
  }
  return {};
}

async function runSimulation() {
  console.log('🚀 Iniciando Simulação do AI-DLC...\n');

  // 0. Limpar banco de dados
  console.log('🧹 Limpando dados de simulações anteriores...');
  await apiFetch(`${API_URL}/test/reset`, { method: 'POST' });
  console.log('✅ Banco limpo.\n');

  // 1. Criar um novo projeto
  console.log('📁 Criando projeto...');
  const project = await apiFetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Plataforma Orbit', description: 'Sistema de gestão de viagens espaciais com foco em escalabilidade.' })
  });
  const projectId = project.id;
  console.log(`✅ Projeto criado: ${project.name} (ID: ${projectId})`);

  // 2. Criar Agentes
  console.log('🤖 Criando agentes e humano...');
  
  const createAgent = async (name, id, roleDesc) => {
    return await apiFetch(`${API_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'ai', model: 'gemini-1.5-flash', id, description: roleDesc })
    });
  };

  const agentA = await createAgent('Dev_Frontend_Alpha', 'agent_a', 'Especialista em React e UI/UX');
  const agentB = await createAgent('TechLead_Beta', 'agent_b', 'Arquiteto de Software e Líder Técnico');
  const agentC = await createAgent('QA_Gama', 'agent_c', 'Engenheiro de Qualidade e Testes');
  
  // Criar o humano
  await apiFetch(`${API_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: HUMAN_ID, name: 'Rodrigo', type: 'human' })
  });
  
  // 3. Adicionar Agentes ao Projeto
  console.log('🔗 Vinculando agentes ao projeto...');
  const addAgent = async (agentId, role) => {
    await apiFetch(`${API_URL}/projects/${projectId}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, role })
    });
  };
  
  await addAgent(agentA.id, 'Frontend Developer');
  await addAgent(agentB.id, 'Architect');
  await addAgent(agentC.id, 'QA Tester');
  await addAgent(HUMAN_ID, 'Product Owner'); 

  console.log('\n--- TUDO PRONTO! ABRA A TELA DO PROJETO NO NAVEGADOR AGORA! ---\n');
  console.log(`URL sugerida: http://localhost:5173/projects/${projectId}`);
  console.log('⏳ O script vai aguardar 8 segundos para a IA Arquiteta gerar o Shared Context Base (Esqueleto)...\n');
  await sleep(8000);

  // 4. Humano pede para Agent A ler o projeto e gerar contexto real
  console.log('💬 Humano pedindo para analisar código real...');
  const msg1 = await apiFetch(`${API_URL}/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': HUMAN_ID },
    body: JSON.stringify({
      type: 'decision',
      content: 'Dev_Frontend_Alpha, por favor faça a varredura do nosso código fonte atual e atualize o contexto do projeto.',
      toAgentId: agentA.id
    })
  });
  await sleep(3000);

  console.log('🤖 Alpha informando que vai ler os arquivos...');
  const msg2 = await apiFetch(`${API_URL}/projects/${projectId}/messages/${msg1.id}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentA.id },
    body: JSON.stringify({
      content: 'Entendido, Rodrigo. Executando leitura do repositório via FileSystem Tool...'
    })
  });
  await sleep(2000);

  console.log('🔍 Alpha chamando a API de Context Analyze...');
  // Simulating the actual real facts found in the "repository"
  await apiFetch(`${API_URL}/projects/${projectId}/context/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysisData: "Encontrei um package.json na pasta 'web' com React 18, Vite e TailwindCSS v4. Na pasta 'server', encontrei Node.js (Express) na porta 3001 e banco de dados SQLite nativo (node:sqlite) rodando em WAL mode. Toda a comunicação em tempo real é feita por Socket.IO."
    })
  });
  await sleep(6000);

  console.log('✅ Alpha confirmando o sucesso...');
  await apiFetch(`${API_URL}/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentA.id },
    body: JSON.stringify({
      type: 'answer',
      content: 'O Contexto Compartilhado foi atualizado com sucesso! Agora nossa documentação reflete EXATAMENTE o que temos no repositório.',
      threadId: msg1.id
    })
  });
  await sleep(3000);

  // 5. Fluxo de conversa realista continua
  console.log('💬 Continuando o Chat do Terminal...');

  console.log('🟡 QA_Gama fazendo pergunta...');
  const msg3 = await apiFetch(`${API_URL}/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentC.id },
    body: JSON.stringify({
      type: 'question',
      content: 'Alpha, para os testes E2E do fluxo de compra de passagens, como você vai nomear os data-testids dos formulários?',
      toAgentId: agentA.id
    })
  });
  await sleep(4000);

  console.log('✅ Alpha respondendo Gama...');
  await apiFetch(`${API_URL}/projects/${projectId}/messages/${msg3.id}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentA.id },
    body: JSON.stringify({
      content: 'Vou usar o padrão `data-testid="form-[nome]"`. Ex: `form-checkout`.'
    })
  });
  await sleep(3000);

  console.log('🚨 QA_Gama bloqueado...');
  const msg4 = await apiFetch(`${API_URL}/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentC.id },
    body: JSON.stringify({
      type: 'blocker',
      priority: 'critical',
      content: 'TechLead, estou tentando validar a integração de Gateway de Pagamentos, mas as chaves de API Sandbox não estão nas variáveis de ambiente. Estou travado sem isso.',
      toAgentId: agentB.id
    })
  });
  await sleep(4000);

  console.log('🚨 TechLead escalando para o Rodrigo...');
  await apiFetch(`${API_URL}/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentB.id },
    body: JSON.stringify({
      type: 'question',
      priority: 'high',
      content: 'Rodrigo (PO), nós não temos acesso às credenciais do Gateway de Pagamento para finalizar a release. Você pode aprovar o uso do Mock de Pagamentos temporariamente ou prefere nos fornecer as chaves via cofre de senhas? Preciso do seu reply para o QA Gama seguir.',
      toAgentId: HUMAN_ID
    })
  });

  console.log('\n🎉 Simulação finalizada! Verifique a interface:');
  console.log('1. O Contexto Compartilhado foi criado pela IA.');
  console.log('2. O Contexto Compartilhado foi sutilmente atualizado pelas decisões tomadas no chat.');
  console.log('3. Um Blocker crítico apareceu.');
  console.log('4. Uma pergunta aguarda SUA RESPOSTA (Reply) no Terminal! Vá na UI e responda o TechLead!');
}

runSimulation().catch(console.error);
