import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/connection';
import db from './db/connection';
import projectsRouter from './routes/projects';
import agentsRouter from './routes/agents';
import messagesRouter from './routes/messages';

import aiRouter from './routes/ai';
import notificationsRouter from './routes/notifications';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // For MVP
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

app.set('io', io); // Allow routes to access io

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/projects/:projectId/ai', aiRouter);
app.use('/api/projects/:projectId/messages', messagesRouter);

// Reset endpoint for simulation script
app.post('/api/test/reset', (req, res) => {
  try {
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM decisions;
      DELETE FROM messages;
      DELETE FROM project_agents;
      DELETE FROM agents;
      DELETE FROM projects;
    `);
    res.json({ success: true, message: 'Database reset' });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Initialize DB
initDb();

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_project', ({ projectId }) => {
    socket.join(`project_${projectId}`);
    console.log(`Socket ${socket.id} joined project_${projectId}`);
  });

  socket.on('leave_project', ({ projectId }) => {
    socket.leave(`project_${projectId}`);
    console.log(`Socket ${socket.id} left project_${projectId}`);
  });

  socket.on('typing', ({ projectId, agentId }) => {
    socket.to(`project_${projectId}`).emit('agent_typing', { agentId });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`AI-DLC Server running on port ${PORT}`);
});
