import { Router } from 'express';
import * as queries from '../db/queries';

const router = Router();

router.get('/:agentId', (req, res) => {
  const { agentId } = req.params;
  const notifications = queries.getAgentNotifications(agentId);
  res.json(notifications);
});

router.patch('/:id/read', (req, res) => {
  const { id } = req.params;
  queries.markNotificationRead(id);
  res.json({ success: true });
});

router.post('/:agentId/read-all', (req, res) => {
  const { agentId } = req.params;
  queries.markAllNotificationsRead(agentId);
  res.json({ success: true });
});

export default router;
