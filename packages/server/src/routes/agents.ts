import express from 'express';
import { Router } from 'express';
import * as queries from '../db/queries';

const router = Router();

router.get('/', (req, res) => {
  const agents = queries.getAgents();
  res.json(agents);
});

router.post('/', (req, res) => {
  const { name, type, model, description, id } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }
  const agent = queries.createAgent(name, type, model, description, id);
  res.status(201).json(agent);
});

export default router;
