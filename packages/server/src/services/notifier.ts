import * as queries from '../db/queries';

export function processNewMessage(io: any, message: any) {
  // Rule: if it's a blocker or high priority, notify humans
  if (message.type === 'blocker' || message.priority === 'critical' || message.priority === 'high') {
    // Find human agents in this project
    const projectAgents = queries.getProjectAgents(message.project_id);
    const humans = projectAgents.filter(a => a.type === 'human');
    
    for (const human of humans) {
      const notif = queries.createNotification({
        agentId: human.id as string,
        messageId: message.id as string,
        level: message.type === 'blocker' ? 'urgent' : 'important',
        title: message.type === 'blocker' ? '🔴 Blocker Detectado' : '🟡 Atenção Necessária',
        body: `Mensagem de ${message.from_agent_id}: ${message.content.substring(0, 50)}...`
      });
      
      // Emit via socket to that specific human (or broadcast for now)
      io.emit('notification', { notification: notif });
    }
  }

  // Rule: If message is a question directed to someone, notify them
  if (message.type === 'question' && message.to_agent_id) {
    const notif = queries.createNotification({
      agentId: message.to_agent_id as string,
      messageId: message.id as string,
      level: 'important',
      title: 'Nova Pergunta',
      body: `Você tem uma pergunta de ${message.from_agent_id}`
    });
    
    io.emit('notification', { notification: notif });
  }
}
