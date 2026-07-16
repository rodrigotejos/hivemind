const API_URL = 'http://localhost:3001/api';
const HUMAN_ID = 'rodrigo';

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

async function startCleanProject() {
  console.log('🧹 Limpando dados anteriores...');
  await apiFetch(`${API_URL}/test/reset`, { method: 'POST' });
  console.log('✅ Banco limpo.');

  console.log('📁 Criando projeto dashboard-bi...');
  const project = await apiFetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name: 'dashboard-bi', 
      description: 'Sistema de Business Intelligence e visualização de métricas de performance.' 
    })
  });
  const projectId = project.id;
  console.log(`✅ Projeto criado com ID: ${projectId}`);

  console.log('👤 Registrando Rodrigo (Human/Product Owner)...');
  await apiFetch(`${API_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: HUMAN_ID, name: 'Rodrigo', type: 'human' })
  });

  console.log('🔗 Vinculando Rodrigo ao projeto...');
  await apiFetch(`${API_URL}/projects/${projectId}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId: HUMAN_ID, role: 'Product Owner' })
  });

  console.log('\n🎉 PROJETO E BANCO RESETADOS E PRONTOS PARA USO!');
  console.log(`URL do Dashboard: http://localhost:5173/projects/${projectId}/messages`);
  console.log(`Projeto ID para os seus Agentes: ${projectId}`);
}

startCleanProject().catch(console.error);
